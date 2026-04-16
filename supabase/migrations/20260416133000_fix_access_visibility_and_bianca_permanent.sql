-- Ajuste solicitado: manter acesso permanente para a usuária Bianca.
UPDATE public.users
SET access_expires_at = NULL,
    updated_at = NOW()
WHERE lower(email) = lower('biancacscheffer@gmail.com');
