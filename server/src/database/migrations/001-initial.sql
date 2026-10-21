create table if not exists columns (
  id serial primary key,
  name text not null,
  position int not null default 0,
  is_done boolean not null default false
);

create table if not exists labels (
  id serial primary key,
  name text not null unique,
  color text not null,
  grp text not null default 'Geral',
  position int not null default 0
);

create table if not exists tasks (
  id serial primary key,
  title text not null,
  description text not null default '',
  column_id int not null references columns(id),
  position int not null default 0,
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  due_date date,
  checklist jsonb not null default '[]',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_column_idx on tasks (column_id, position);

create table if not exists branches (
  id serial primary key,
  repo text not null,
  name text not null,
  merged boolean not null default false,
  created_at timestamptz not null default now(),
  unique (repo, name)
);
alter table branches add column if not exists color text not null default '#8B5CF6';
alter table branches add column if not exists notes text not null default '';
alter table branches add column if not exists locked boolean not null default false;
alter table tasks add column if not exists branch_id int references branches(id) on delete set null;
create index if not exists tasks_branch_idx on tasks (branch_id);

create table if not exists task_labels (
  task_id int not null references tasks(id) on delete cascade,
  label_id int not null references labels(id) on delete cascade,
  primary key (task_id, label_id)
);
