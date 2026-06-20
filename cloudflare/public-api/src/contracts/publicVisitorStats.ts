export interface PublicVisitorStatsSnapshotContract {
  total: number;
  today: number;
  enabled: boolean;
  usersToday: number;
  usersYesterday: number;
  usersThisMonth: number;
  usersThisYear: number;
  totalUsers: number;
  totalViews: number;
  onlineUsers: number;
  updatedAt: string;
  generatedAt: string;
}
