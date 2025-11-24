-- Criar enum para tipos de página
CREATE TYPE page_type AS ENUM (
  'tournament_public',
  'tournament_info',
  'scoreboard',
  'spectator'
);

-- Criar tabela de tracking de acessos
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type page_type NOT NULL,
  resource_id UUID NOT NULL, -- ID do torneio, jogo, etc.
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_page_views_resource ON page_views(resource_id, page_type);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_type ON page_views(page_type);

-- RLS (Row Level Security)
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode inserir (para tracking)
CREATE POLICY "Anyone can insert page views"
  ON page_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Política: Apenas admins podem ler
CREATE POLICY "Admins can read page views"
  ON page_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin_sistema'
    )
  );

-- Comentários
COMMENT ON TABLE page_views IS 'Tabela para tracking de acessos às páginas públicas';
COMMENT ON COLUMN page_views.page_type IS 'Tipo de página acessada';
COMMENT ON COLUMN page_views.resource_id IS 'ID do recurso (torneio, jogo, etc.)';
COMMENT ON COLUMN page_views.user_id IS 'ID do usuário logado (null se anônimo)';
COMMENT ON COLUMN page_views.ip_address IS 'Endereço IP do usuário';
COMMENT ON COLUMN page_views.user_agent IS 'User agent do navegador';
COMMENT ON COLUMN page_views.referrer IS 'URL de origem (de onde veio)';

