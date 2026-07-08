import { createSupabaseClient } from "./client";

export class AuthService {
  constructor(
    private readonly supabaseUrl: string,
    private readonly supabaseAnonKey: string
  ) {}

  private get client() {
    return createSupabaseClient(
      this.supabaseUrl,
      this.supabaseAnonKey
    );
  }

  async signOut() {
    return this.client.auth.signOut();
  }

  async getSession() {
    return this.client.auth.getSession();
  }

  async getUser() {
    return this.client.auth.getUser();
  }
}