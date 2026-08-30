import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type ClientTabsParamList = {
  Home: undefined;
  Progress: undefined;
  ChatTab: undefined;
  Profile: undefined;
};

export type ChatParams = { coachId: string; clientId: string; name: string };
export type PhotoViewParams = { uri: string; label: string };

export type ClientStackParamList = {
  /** Nested tab navigator — screens deep-link into it with `{ screen: … }`. */
  Tabs: NavigatorScreenParams<ClientTabsParamList>;
  Plan: { kind: 'workout' | 'diet'; coachId: string };
  CoachDetail: { coachId: string };
  Checkout: { packageId: string; coachId: string };
  Chat: ChatParams;
  PhotoView: PhotoViewParams;
  Browse: undefined;
};

export type CoachTabsParamList = {
  Clients: undefined;
  Messages: undefined;
  CoachProfile: undefined;
};

export type CoachStackParamList = {
  /** Nested tab navigator — screens deep-link into it with `{ screen: … }`. */
  Tabs: NavigatorScreenParams<CoachTabsParamList>;
  ClientDetail: { clientId: string };
  PlanBuilder: {
    clientId?: string;
    kind: 'workout' | 'diet';
    clientName?: string;
    /** template mode: builder edits a library template instead of a client plan */
    mode?: 'client' | 'template';
    templateId?: string;
  };
  Chat: ChatParams;
  PhotoView: PhotoViewParams;
};

export type AdminStackParamList = {
  AdminHome: undefined;
};
