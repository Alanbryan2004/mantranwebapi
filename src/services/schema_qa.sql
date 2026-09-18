-- ========================================================
-- SCHEMA: MÓDULO DE QA TESTES (CENÁRIOS E APONTAMENTOS)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.qa_cenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tela TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'OK', 'ERRO'
    observacao_erro TEXT,
    observacao_correcao TEXT,
    evidencia_imagem TEXT, -- Print / screenshot do erro em base64 ou URL
    tecnico_id UUID,
    tecnico_nome TEXT,
    qa_id UUID,
    qa_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Caso a tabela já exista, adiciona a coluna evidencia_imagem se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'qa_cenarios' 
        AND column_name = 'evidencia_imagem'
    ) THEN 
        ALTER TABLE public.qa_cenarios ADD COLUMN evidencia_imagem TEXT; 
    END IF; 
END $$;

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_qa_cenarios_tela ON public.qa_cenarios(tela);
CREATE INDEX IF NOT EXISTS idx_qa_cenarios_tecnico_id ON public.qa_cenarios(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_qa_cenarios_status ON public.qa_cenarios(status);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.qa_cenarios ENABLE ROW LEVEL SECURITY;

-- Política de permissão total para anon (mesmo padrão das demais tabelas do projeto)
DROP POLICY IF EXISTS "Allow anon all on qa_cenarios" ON public.qa_cenarios;
CREATE POLICY "Allow anon all on qa_cenarios" 
ON public.qa_cenarios 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- Conceder permissões
GRANT ALL ON TABLE public.qa_cenarios TO anon;
GRANT ALL ON TABLE public.qa_cenarios TO authenticated;
GRANT ALL ON TABLE public.qa_cenarios TO service_role;
