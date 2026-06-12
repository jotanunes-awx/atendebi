import { MessageAuthorType, MessageDirection } from '@prisma/client';

/**
 * Mapeia a direcao da mensagem para o tipo de autor generico, sem conceito de bot.
 * Usado por origens que so tem humano nos dois lados (GLPI, Teams Phone).
 */
export function authorFromDirection(direction: MessageDirection): MessageAuthorType {
  if (direction === MessageDirection.INBOUND) {
    return MessageAuthorType.CUSTOMER;
  }

  if (direction === MessageDirection.OUTBOUND) {
    return MessageAuthorType.AGENT;
  }

  return MessageAuthorType.SYSTEM;
}

/**
 * Classifica o autor de uma mensagem do BLiP. Uma mensagem de saida sem nome de
 * atendente e considerada do bot; com nome de atendente, e de um humano.
 * Esta logica e a mesma usada tanto no webhook quanto no sync por API.
 */
export function classifyBlipAuthor(
  direction: MessageDirection,
  agentName?: string | null,
): MessageAuthorType {
  if (direction === MessageDirection.OUTBOUND && !(agentName && agentName.trim().length > 0)) {
    return MessageAuthorType.BOT;
  }

  return authorFromDirection(direction);
}

/** Rotulo legivel para exibir em metadados/telas. */
export function authorTypeLabel(authorType: MessageAuthorType): string {
  switch (authorType) {
    case MessageAuthorType.CUSTOMER:
      return 'Cliente';
    case MessageAuthorType.AGENT:
      return 'Atendente';
    case MessageAuthorType.BOT:
      return 'Bot';
    default:
      return 'Sistema';
  }
}
