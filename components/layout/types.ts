export type ShellUser = {
  name: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
};

export type ShellCounts = {
  requests: number;
  messages: number;
};
