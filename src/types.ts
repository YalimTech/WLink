export interface User {
  id: string;
  companyId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  createdAt: Date;
}

export enum InstanceState {
  notAuthorized = "notAuthorized",
  authorized = "authorized",
  yellowCard = "yellowCard",
  blocked = "blocked",
  starting = "starting",
}

export interface Instance {
  id: bigint;
  idInstance: bigint;
  phoneNumber?: string | null;
  name?: string | null;
  apiTokenInstance: string;
  stateInstance?: InstanceState | null;
  userId: string;
  settings?: Record<string, any> | null;
  createdAt: Date;
}

export interface MessageStatusPayload {
  status?: "delivered" | "read" | "failed" | "pending";
  locationId: string;
  messageId: string;
  message?: string;
  error?: string;
}

export interface SendResponse {
  status: string;
  message: string;
  any?: any;
}

export interface AuthReq extends Request {
  locationId: string;
}

export interface GhlUserData {
  userId: string;
  companyId: string;
  roles: string[];
  type: "agency";
  username: string;
  email: string;
  active: boolean;
}

export interface GhPlatformMessage {
  contactId: string;
  locationId: string;
  message: string;
  direction: "inbound" | "outbound";
  conversationProviderId?: string;
  attachments?: GhPlatformAttachment[];
  timestamp?: Date;
}

export interface GhPlatformAttachment {
  url?: string;
  fileUrl?: string;
  filename?: string;
  caption?: string;
}

export interface GhlChannelSettings {
  call: GhlInboundSettings;
  email: GhlInboundSettings;
  sms: GhlInboundSettings;
  whatsapp: GhlInboundSettings;
  fb: GhlInboundSettings;
}

export interface GhlInboundSettings {
  all: {
    status: string;
    message: string;
  };
}

export interface GhlCustomField {
  id?: string;
  key?: string;
  field_value?: string;
  value?: string;
}

export interface GhlAttributionSource {
  url?: string;
  campaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  campaignId?: string;
  fbclid?: string;
  gclid?: string;
  msclkid?: string;
  dclid?: string;
  fbc?: string;
  fbp?: string;
  fireflyId?: string;
  userAgent?: string;
  ip?: string;
  medium?: string;
  mediumId?: string;
}

export interface GhlContactUpsertRequest {
  idInstance?: string;
  name?: string | null;
  lastName?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string;
  website?: string;
  timezone?: string;
  dnd?: boolean;
  dndSettings?: GhlChannelSettings;
  inboundSettings?: GhlInboundSettings;
  tags?: string[];
  customFields?: GhlCustomField[];
  source?: string;
  country?: string;
  companyName?: string | null;
  assignedTo?: string;
  contact?: any;
}

export interface GhlContact {
  id: string;
  name: string;
  locationId: string;
  firstName: string;
  lastName: string;
  email: string;
  emailLowerCase: string;
  timezone: string;
  company: string;
  phone: string;
  dnd: boolean;
  dndSettings: GhlChannelSettings;
  type: string;
  source: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  website: string;
  tags: string[];
  dateOfBirth: string;
  dateUpdated: string;
  attachments: string;
  ssn: string;
  keyword: string;
  firstNameLowerCase: string;
  fullNameLowerCase: string;
  lastNameLowerCase: string;
  userFields: GhlCustomField[];
  businessId: string;
  attributionSource: GhlAttributionSource;
  lastAttributionSource: GhlAttributionSource;
  visitorId: string;
}

export interface GhlContactUpsertResponse {
  move: boolean;
  contact: GhlContact;
  traceId: string;
}

