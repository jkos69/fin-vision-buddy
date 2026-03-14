
-- Table: access_passwords
CREATE TABLE public.access_passwords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  senha TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ceo', 'diretoria', 'area')),
  diretoria TEXT,
  area TEXT,
  responsavel TEXT,
  nome_display TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: opex_uploads
CREATE TABLE public.opex_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by TEXT NOT NULL,
  filename TEXT NOT NULL,
  total_records INTEGER NOT NULL,
  meses_real INTEGER[] DEFAULT '{}',
  total_orcado NUMERIC DEFAULT 0,
  total_realizado NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: opex_records
CREATE TABLE public.opex_records (
  id BIGSERIAL PRIMARY KEY,
  upload_id UUID REFERENCES public.opex_uploads(id) ON DELETE CASCADE,
  base TEXT NOT NULL,
  centro_custo TEXT,
  descricao_ccusto TEXT,
  area_grupo1 TEXT NOT NULL,
  diretoria TEXT NOT NULL,
  responsavel_area TEXT,
  conta_contabil TEXT,
  descricao_conta TEXT,
  recurso TEXT NOT NULL,
  pacote TEXT NOT NULL,
  debito NUMERIC DEFAULT 0,
  credito NUMERIC DEFAULT 0,
  executado NUMERIC DEFAULT 0,
  mes INTEGER NOT NULL,
  tipo TEXT,
  data_lcto TEXT,
  numero_lote TEXT,
  historico TEXT,
  nome_fornecedor TEXT,
  desc_pedido TEXT,
  fornecedor_gerencial TEXT
);

CREATE INDEX idx_opex_records_upload ON public.opex_records(upload_id);
CREATE INDEX idx_opex_records_base_mes ON public.opex_records(base, mes);
CREATE INDEX idx_opex_records_diretoria ON public.opex_records(diretoria);
CREATE INDEX idx_opex_records_area ON public.opex_records(area_grupo1);

-- RLS
ALTER TABLE public.opex_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_passwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON public.opex_records FOR SELECT USING (true);
CREATE POLICY "public_insert" ON public.opex_records FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete" ON public.opex_records FOR DELETE USING (true);
CREATE POLICY "public_read_uploads" ON public.opex_uploads FOR SELECT USING (true);
CREATE POLICY "public_insert_uploads" ON public.opex_uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete_uploads" ON public.opex_uploads FOR DELETE USING (true);
CREATE POLICY "public_read_passwords" ON public.access_passwords FOR SELECT USING (true);
