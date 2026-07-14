export type RecipientEntryType =
  | "reply"
  | "photo"
  | "audio"
  | "future_update"
  | "memory";

export type RecipientMediaAsset = {
  type: "image" | "audio";
  path: string;
  url?: string;
  name?: string;
};

export type RecipientEntry = {
  id: string;
  entryType: RecipientEntryType;
  content: string;
  media: RecipientMediaAsset[];
  status:
    | "visible"
    | "owner_hidden"
    | "deletion_requested"
    | "deleted"
    | "moderated";
  createdAt: string;
  updatedAt: string;
  ownedByCurrentUser?: boolean;
};

export type MemorySpaceSummary = {
  managementPhase: "creator_managed" | "co_managed" | "recipient_managed";
  recipientBound: boolean;
  recipientIsCurrentUser: boolean;
  canBindAccount: boolean;
  canRequestInvites: boolean;
  invitePermissionApproved: boolean;
  inviteLimitRemaining: number;
  entries: RecipientEntry[];
};
