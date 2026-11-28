import React from 'react';
import type { CaseDocument, CommunicationLog } from '../../types/domain';
import type { PortalChatTopicId } from '../../utils/documentChat';
import { QuickConsultantChat } from './QuickConsultantChat';

interface DocumentChatWidgetProps {
  clientId: string;
  caseId?: string;
  remetenteUid: string;
  autorNome: string;
  docs: CaseDocument[];
  caseTitle?: string;
  externalOpenNonce?: number;
  externalTopic?: PortalChatTopicId;
  externalPrefillMessage?: string;
  sharedMessages?: CommunicationLog[];
}

export const DocumentChatWidget: React.FC<DocumentChatWidgetProps> = (props) => {
  return <QuickConsultantChat mode="floating" {...props} />;
};
