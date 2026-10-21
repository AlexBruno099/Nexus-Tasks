-- A chave composta cobre task_id; este índice atende exclusões e consultas por etiqueta.
CREATE INDEX IF NOT EXISTS task_labels_label_idx ON task_labels (label_id);
