import { CasualMatch } from "./casualMatches";
import { GameState } from "@/types/volleyball";

// Logos VB Jukin
const VB_JUKIN_LOGO = "https://i.postimg.cc/SQHJ2c0V/vb-jukin-logo.png"; // Logo com imagem e escrito
const VB_JUKIN_LOGO_TEXT_ONLY = "https://i.postimg.cc/NFZYK85C/vb-jukin-logo-sem-imagem.png"; // Logo só com escrito

/**
 * Gera uma imagem de compartilhamento do resultado do jogo
 */
export const generateShareImage = async (
  match: CasualMatch,
  gameState: GameState | null
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar contexto do canvas');

  // Configurações do canvas
  const width = 1200;
  const height = 630;
  canvas.width = width;
  canvas.height = height;

  // Fundo gradiente
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Logo/Marca VB Jukin - carregar antes de desenhar
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  
  // Aguardar carregamento da imagem antes de continuar
  await new Promise<void>((resolve) => {
    logoImg.onload = () => resolve();
    logoImg.onerror = () => {
      console.warn('Erro ao carregar logo, usando texto como fallback');
      // Fallback para texto se a imagem não carregar
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('VB Jukin', width / 2, 80);
      resolve();
    };
    logoImg.src = VB_JUKIN_LOGO;
  });

  // Desenhar logo se carregou com sucesso (maior e mais visível)
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    const logoHeight = 100;
    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
    ctx.drawImage(logoImg, (width - logoWidth) / 2, 30, logoWidth, logoHeight);
  }

  // Título do jogo (ajustado para dar espaço à logo)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${match.team_a_name} vs ${match.team_b_name}`, width / 2, 180);

  // Informações do jogo
  ctx.font = '26px Arial';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText(`${match.category} • ${match.modality}`, width / 2, 220);

  // Placar
  if (gameState && gameState.scores.teamA.length > 0) {
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ffffff';
    
    let yPos = 280;
    gameState.scores.teamA.forEach((scoreA, index) => {
      const scoreB = gameState.scores.teamB[index] || 0;
      const setText = `Set ${index + 1}: ${match.team_a_name} ${scoreA} x ${scoreB} ${match.team_b_name}`;
      ctx.fillText(setText, width / 2, yPos);
      yPos += 50;
    });

    // Resultado final se o jogo terminou
    if (gameState.isGameEnded) {
      const winner = gameState.setsWon.teamA > gameState.setsWon.teamB
        ? match.team_a_name
        : match.team_b_name;
      ctx.font = 'bold 40px Arial';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`Vencedor: ${winner}`, width / 2, yPos + 40);
    }
  } else {
    ctx.font = '28px Arial';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Jogo ainda não iniciado', width / 2, 320);
  }

  // Logo no rodapé também (menor)
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    const footerLogoHeight = 40;
    const footerLogoWidth = (logoImg.width / logoImg.height) * footerLogoHeight;
    ctx.drawImage(logoImg, (width - footerLogoWidth) / 2, height - 60, footerLogoWidth, footerLogoHeight);
  }

  // Data de criação
  const createdDate = new Date(match.created_at);
  ctx.font = '16px Arial';
  ctx.fillStyle = '#6b7280';
  ctx.fillText(
    `Criado em ${createdDate.toLocaleDateString('pt-BR')}`,
    width / 2,
    height - 20
  );

  // Converter para blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Falha ao gerar imagem'));
      }
    }, 'image/png');
  });
};

/**
 * Compartilha a imagem usando Web Share API (mobile) ou faz download (desktop)
 */
export const shareImage = async (
  match: CasualMatch,
  gameState: GameState | null
): Promise<void> => {
  try {
    const blob = await generateShareImage(match, gameState);
    const file = new File([blob], `vb-jukin-${match.team_a_name}-vs-${match.team_b_name}-${Date.now()}.png`, {
      type: 'image/png',
    });

    // Verificar se Web Share API está disponível e suporta arquivos
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Resultado: ${match.team_a_name} vs ${match.team_b_name}`,
          text: `Confira o resultado do jogo de vôlei de praia!`,
          files: [file],
        });
        return; // Compartilhamento bem-sucedido
      } catch (shareError: any) {
        // Se o usuário cancelar, não fazer nada
        if (shareError.name === 'AbortError') {
          return;
        }
        // Se der erro, tentar fallback para download
        console.log('Erro ao compartilhar, usando fallback:', shareError);
      }
    }

    // Fallback: download da imagem (desktop ou se Web Share API não disponível)
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vb-jukin-${match.team_a_name}-vs-${match.team_b_name}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar/compartilhar imagem:', error);
    throw error;
  }
};

/**
 * Faz download da imagem de compartilhamento (mantido para compatibilidade)
 * @deprecated Use shareImage() que já detecta automaticamente se deve compartilhar ou fazer download
 */
export const downloadShareImage = async (
  match: CasualMatch,
  gameState: GameState | null
): Promise<void> => {
  return shareImage(match, gameState);
};

