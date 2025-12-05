export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      match_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          match_id: string
          metadata: Json | null
          point_category: string | null
          set_number: number | null
          team: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          match_id: string
          metadata?: Json | null
          point_category?: string | null
          set_number?: number | null
          team?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          match_id?: string
          metadata?: Json | null
          point_category?: string | null
          set_number?: number | null
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_scores: {
        Row: {
          created_at: string | null
          id: string
          match_id: string
          set_number: number
          team_a_points: number
          team_b_points: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id: string
          set_number: number
          team_a_points?: number
          team_b_points?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string
          set_number?: number
          team_a_points?: number
          team_b_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_states: {
        Row: {
          active_timer: Json | null
          created_at: string
          current_server_player: number
          current_server_team: string
          current_set: number
          is_game_ended: boolean
          left_is_team_a: boolean
          match_id: string
          next_server_index: Json | null
          possession: string
          scores: Json
          service_orders: Json | null
          set_configurations: Json | null
          sets_won: Json
          sides_switched: Json
          technical_timeout_used: Json
          timeouts_used: Json
          updated_at: string
        }
        Insert: {
          active_timer?: Json | null
          created_at?: string
          current_server_player?: number
          current_server_team?: string
          current_set?: number
          is_game_ended?: boolean
          left_is_team_a?: boolean
          match_id: string
          next_server_index?: Json | null
          possession?: string
          scores?: Json
          service_orders?: Json | null
          set_configurations?: Json | null
          sets_won?: Json
          sides_switched?: Json
          technical_timeout_used?: Json
          timeouts_used?: Json
          updated_at?: string
        }
        Update: {
          active_timer?: Json | null
          created_at?: string
          current_server_player?: number
          current_server_team?: string
          current_set?: number
          is_game_ended?: boolean
          left_is_team_a?: boolean
          match_id?: string
          next_server_index?: Json | null
          possession?: string
          scores?: Json
          service_orders?: Json | null
          set_configurations?: Json | null
          sets_won?: Json
          sides_switched?: Json
          technical_timeout_used?: Json
          timeouts_used?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_states_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_timeouts: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          match_id: string
          set_number: number | null
          started_at: string
          team: string | null
          timeout_type: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          match_id: string
          set_number?: number | null
          started_at?: string
          team?: string | null
          timeout_type: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          match_id?: string
          set_number?: number | null
          started_at?: string
          team?: string | null
          timeout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_timeouts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          best_of: number | null
          court: string | null
          created_at: string | null
          direct_win_format: boolean | null
          id: string
          modality: string | null
          phase: string | null
          points_per_set: number[] | null
          referee_id: string | null
          scheduled_at: string | null
          side_switch_sum: number[] | null
          status: string | null
          team_a_id: string
          team_b_id: string
          tournament_id: string
        }
        Insert: {
          best_of?: number | null
          court?: string | null
          created_at?: string | null
          direct_win_format?: boolean | null
          id?: string
          modality?: string | null
          phase?: string | null
          points_per_set?: number[] | null
          referee_id?: string | null
          scheduled_at?: string | null
          side_switch_sum?: number[] | null
          status?: string | null
          team_a_id: string
          team_b_id: string
          tournament_id: string
        }
        Update: {
          best_of?: number | null
          court?: string | null
          created_at?: string | null
          direct_win_format?: boolean | null
          id?: string
          modality?: string | null
          phase?: string | null
          points_per_set?: number[] | null
          referee_id?: string | null
          scheduled_at?: string | null
          side_switch_sum?: number[] | null
          status?: string | null
          team_a_id?: string
          team_b_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      password_resets: {
        Row: {
          id: string
          reason: string | null
          reset_at: string | null
          reset_by: string | null
          user_id: string
        }
        Insert: {
          id?: string
          reason?: string | null
          reset_at?: string | null
          reset_by?: string | null
          user_id: string
        }
        Update: {
          id?: string
          reason?: string | null
          reset_at?: string | null
          reset_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          player_a: string
          player_b: string
          player_c: string | null
          player_d: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          player_a: string
          player_b: string
          player_c?: string | null
          player_d?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          player_a?: string
          player_b?: string
          player_c?: string | null
          player_d?: string | null
        }
        Relationships: []
      }
      tournament_teams: {
        Row: {
          created_at: string | null
          group_label: string | null
          id: string
          seed: number | null
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string | null
          group_label?: string | null
          id?: string
          seed?: number | null
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string | null
          group_label?: string | null
          id?: string
          seed?: number | null
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          format_id: string | null
          has_statistics: boolean
          id: string
          include_third_place: boolean | null
          location: string | null
          logo_url: string | null
          match_format_final: string | null
          match_format_groups: string | null
          match_format_quarterfinals: string | null
          match_format_semifinals: string | null
          match_format_third_place: string | null
          modality: string | null
          name: string
          sponsor_logos: Json | null
          start_date: string | null
          status: string | null
          tie_breaker_order: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          format_id?: string | null
          has_statistics?: boolean
          id?: string
          include_third_place?: boolean | null
          location?: string | null
          logo_url?: string | null
          match_format_final?: string | null
          match_format_groups?: string | null
          match_format_quarterfinals?: string | null
          match_format_semifinals?: string | null
          match_format_third_place?: string | null
          modality?: string | null
          name: string
          sponsor_logos?: Json | null
          start_date?: string | null
          status?: string | null
          tie_breaker_order?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          format_id?: string | null
          has_statistics?: boolean
          id?: string
          include_third_place?: boolean | null
          location?: string | null
          logo_url?: string | null
          match_format_final?: string | null
          match_format_groups?: string | null
          match_format_quarterfinals?: string | null
          match_format_semifinals?: string | null
          match_format_third_place?: string | null
          modality?: string | null
          name?: string
          sponsor_logos?: Json | null
          start_date?: string | null
          status?: string | null
          tie_breaker_order?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_revoked: boolean | null
          refresh_token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean | null
          refresh_token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean | null
          refresh_token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_user_list: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          roles: string[]
          updated_at: string
        }[]
      }
      get_user_permissions: { Args: { user_uuid: string }; Returns: string[] }
      get_user_roles: { Args: { user_uuid: string }; Returns: string[] }
      has_role: { Args: { role_name: string; uid?: string }; Returns: boolean }
      is_admin: { Args: { uid?: string }; Returns: boolean }
      user_has_permission: {
        Args: { permission_name: string; user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
