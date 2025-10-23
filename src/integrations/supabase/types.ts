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
      matches: {
        Row: {
          id: string
          tournament_id: string
          team_a_id: string
          team_b_id: string
          scheduled_at: string | null
          court: string | null
          phase: string | null
          status: string | null
          best_of: number | null
          points_per_set: number[] | null
          side_switch_sum: number[] | null
          modality: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          team_a_id: string
          team_b_id: string
          scheduled_at?: string | null
          court?: string | null
          phase?: string | null
          status?: string | null
          best_of?: number | null
          points_per_set?: number[] | null
          side_switch_sum?: number[] | null
          modality?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          team_a_id?: string
          team_b_id?: string
          scheduled_at?: string | null
          court?: string | null
          phase?: string | null
          status?: string | null
          best_of?: number | null
          points_per_set?: number[] | null
          side_switch_sum?: number[] | null
          modality?: string | null
          created_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "matches_tournament_id_fkey", columns: ["tournament_id"], isOneToOne: false, referencedRelation: "tournaments", referencedColumns: ["id"] },
          { foreignKeyName: "matches_team_a_id_fkey", columns: ["team_a_id"], isOneToOne: false, referencedRelation: "teams", referencedColumns: ["id"] },
          { foreignKeyName: "matches_team_b_id_fkey", columns: ["team_b_id"], isOneToOne: false, referencedRelation: "teams", referencedColumns: ["id"] },
        ]
      }
      match_scores: {
        Row: {
          id: string
          match_id: string
          set_number: number
          team_a_points: number
          team_b_points: number
          created_at: string | null
        }
        Insert: {
          id?: string
          match_id: string
          set_number: number
          team_a_points?: number
          team_b_points?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          match_id?: string
          set_number?: number
          team_a_points?: number
          team_b_points?: number
          created_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "match_scores_match_id_fkey", columns: ["match_id"], isOneToOne: false, referencedRelation: "matches", referencedColumns: ["id"] },
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
          player_a: string
          player_b: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          player_a: string
          player_b: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          player_a?: string
          player_b?: string
          created_at?: string | null
        }
        Relationships: []
      }
      tournament_teams: {
        Row: {
          id: string
          tournament_id: string
          team_id: string
          seed: number | null
          group_label: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          team_id: string
          seed?: number | null
          group_label?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          team_id?: string
          seed?: number | null
          group_label?: string | null
          created_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "tournament_teams_tournament_id_fkey", columns: ["tournament_id"], isOneToOne: false, referencedRelation: "tournaments", referencedColumns: ["id"] },
          { foreignKeyName: "tournament_teams_team_id_fkey", columns: ["team_id"], isOneToOne: false, referencedRelation: "teams", referencedColumns: ["id"] },
        ]
      }
      tournaments: {
        Row: {
          id: string
          name: string
          location: string | null
          start_date: string | null
          end_date: string | null
          category: string | null
          modality: string | null
          status: string | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          start_date?: string | null
          end_date?: string | null
          category?: string | null
          modality?: string | null
          status?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          start_date?: string | null
          end_date?: string | null
          category?: string | null
          modality?: string | null
          status?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "tournaments_created_by_fkey", columns: ["created_by"], isOneToOne: false, referencedRelation: "users", referencedColumns: ["id"] },
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
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      get_user_permissions: {
        Args: { user_uuid: string }
        Returns: string[]
      }
      get_user_roles: {
        Args: { user_uuid: string }
        Returns: string[]
      }
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
