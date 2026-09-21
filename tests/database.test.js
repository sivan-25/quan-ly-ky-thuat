import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Postgres migration and RLS enforce building roles, auth and image isolation", async (t) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,public to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;`);
  const migrations = (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort();
  for(const migration of migrations) await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
  ];
  for (const [i, id] of ids.entries())
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [id, `test${i}@example.invalid`, { is_admin: true }],
    );
  await db.query("update public.profiles set is_admin=true where id=$1", [
    ids[0],
  ]);
  await db.query(
    "insert into building_members values('68PĐL',$1,'editor'),('68PĐL',$2,'viewer')",
    [ids[1], ids[2]],
  );
  const as = async (id) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id || "",
    ]);
    await db.exec("set role " + (id ? "authenticated" : "anon"));
  };
  const count = async (table) =>
    Number((await db.query("select count(*) as n from " + table)).rows[0].n);
  let task;
  await t.test(
    "new account cannot self-escalate through metadata or direct writes",
    async () => {
      await as(ids[3]);
      assert.equal(
        (await db.query("select is_admin from profiles")).rows[0].is_admin,
        false,
      );
      assert.equal(await count("buildings"), 0);
      await assert.rejects(
        db.query("update profiles set is_admin=true where id=$1", [ids[3]]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select set_building_member($1,'68PĐL','editor')", [ids[3]]),
        /Không có quyền/,
      );
    },
  );
  await t.test(
    "editor may create tasks only in assigned building",
    async () => {
      await as(ids[1]);
      task = (
        await db.query(
          "insert into tasks(building_id,title,start_date,end_date) values('68PĐL','Kiểm tra máy lạnh','2026-09-21','2026-09-22') returning *",
        )
      ).rows[0];
      await assert.rejects(
        db.query(
          "insert into tasks(building_id,title,start_date,end_date) values('62THL','Forbidden','2026-09-21','2026-09-22')",
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.query(
          "insert into tasks(building_id,title,start_date,end_date,created_by) values('68PĐL','Spoof','2026-09-21','2026-09-22',$1)",
          [ids[0]],
        ),
        /row-level security/,
      );
    },
  );
  await t.test("viewer can read but cannot modify or delete", async () => {
    await as(ids[2]);
    assert.equal(await count("tasks"), 1);
    assert.equal(
      (await db.query("update tasks set title='No' returning id")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from tasks returning id")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into tasks(building_id,title,start_date,end_date) values('68PĐL','No','2026-09-21','2026-09-22')",
      ),
      /row-level security/,
    );
  });
  await t.test(
    "outsider cannot read or mutate tasks and anonymous has no grants",
    async () => {
      await as(ids[3]);
      assert.equal(await count("tasks"), 0);
      assert.equal(
        (await db.query("update tasks set title='No' returning id")).rows
          .length,
        0,
      );
      await as(null);
      await assert.rejects(
        db.query("select * from tasks"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "optimistic concurrency and immutable building protect work",
    async () => {
      await as(ids[1]);
      const old = task.updated_at;
      const saved = (
        await db.query(
          "update tasks set status='Hoàn thành' where id=$1 and updated_at=$2 returning *",
          [task.id, old],
        )
      ).rows[0];
      assert.ok(saved.completed_at);
      assert.equal(
        (
          await db.query(
            "update tasks set title='Stale' where id=$1 and updated_at=$2 returning id",
            [task.id, old],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        db.query("update tasks set building_id='62THL' where id=$1", [task.id]),
        /Không thể đổi/,
      );
    },
  );
  await t.test(
    "image policies enforce existing task, building, and viewer read-only",
    async () => {
      const name = `68PĐL/${task.id}/photo.jpg`;
      await as(ids[1]);
      await db.query(
        "insert into storage.objects(bucket_id,name) values('task-images',$1)",
        [name],
      );
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('task-images',$1)",
          [`62THL/${task.id}/photo.jpg`],
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('task-images','68PĐL/not-a-task/photo.jpg')",
        ),
        /row-level security/,
      );
      await as(ids[2]);
      assert.equal(await count("storage.objects"), 1);
      assert.equal(
        (await db.query("delete from storage.objects returning id")).rows
          .length,
        0,
      );
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('task-images',$1)",
          [name + "2"],
        ),
        /row-level security/,
      );
      await as(ids[3]);
      assert.equal(await count("storage.objects"), 0);
    },
  );
  await t.test("admin can grant and revoke access immediately", async () => {
    await as(ids[0]);
    await db.query("select set_building_member($1,'68PĐL','viewer')", [ids[3]]);
    await as(ids[3]);
    assert.equal(await count("tasks"), 1);
    await as(ids[0]);
    await db.query("select set_building_member($1,'68PĐL',null)", [ids[3]]);
    await as(ids[3]);
    assert.equal(await count("tasks"), 0);
  });
  await t.test(
    "deletion freezes edits and uploads without orphaning images",
    async () => {
      await as(ids[1]);
      await assert.rejects(
        db.query("delete from tasks where id=$1", [task.id]),
        /Còn ảnh chưa xóa/,
      );
      await db.query("update tasks set deleting_at=now() where id=$1", [
        task.id,
      ]);
      await assert.rejects(
        db.query("update tasks set title='After deletion' where id=$1", [
          task.id,
        ]),
        /Công việc đang xóa/,
      );
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('task-images',$1)",
          [`68PĐL/${task.id}/late.jpg`],
        ),
        /row-level security/,
      );
      assert.equal(await count("tasks"), 1);
    },
  );
  await t.test(
    "editor can delete owned-building images and tasks",
    async () => {
      await as(ids[1]);
      assert.equal(
        (await db.query("delete from storage.objects returning id")).rows
          .length,
        1,
      );
      assert.equal(
        (await db.query("delete from tasks returning id")).rows.length,
        1,
      );
    },
  );
  await db.close();
});
