// Minimal typings for the subset of the WhatsApp Cloud API webhook payloads
// and send envelopes that we use. See:
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

export interface WhatsAppWebhookBody {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string; // WABA id
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  field: string; // "messages"
  value: WhatsAppChangeValue;
}

export interface WhatsAppChangeValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppInboundMessage[];
  statuses?: WhatsAppStatus[];
  errors?: WhatsAppError[];
}

export interface WhatsAppContact {
  wa_id: string;
  profile: { name: string };
}

export interface WhatsAppInboundMessage {
  id: string; // wamid
  from: string; // wa_id
  timestamp: string; // unix seconds (string)
  type: string;
  text?: { body: string };
  image?: WhatsAppMediaObject;
  video?: WhatsAppMediaObject;
  audio?: WhatsAppMediaObject;
  document?: WhatsAppMediaObject & { filename?: string };
  sticker?: WhatsAppMediaObject;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  button?: { text: string; payload: string };
  interactive?: unknown;
  context?: { from: string; id: string };
  errors?: WhatsAppError[];
}

export interface WhatsAppMediaObject {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  voice?: boolean;
}

export interface WhatsAppStatus {
  id: string; // wamid
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: { id: string; origin?: { type: string } };
  pricing?: { billable: boolean; category: string; pricing_model: string };
  errors?: WhatsAppError[];
}

export interface WhatsAppError {
  code: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
}

// ---- Outbound send envelopes ----

export interface SendTextMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

export type MediaSendType = 'image' | 'video' | 'audio' | 'document';
