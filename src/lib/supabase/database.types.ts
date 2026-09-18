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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          customer_id: string
          duration_minutes: number
          employee_id: string
          employee_name: string
          ends_at: string
          id: string
          price_cents: number
          request_fingerprint: string | null
          request_id: string
          service_id: string
          service_name: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string
          customer_id: string
          duration_minutes: number
          employee_id: string
          employee_name: string
          ends_at: string
          id?: string
          price_cents: number
          request_fingerprint?: string | null
          request_id: string
          service_id: string
          service_name: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          customer_id?: string
          duration_minutes?: number
          employee_id?: string
          employee_name?: string
          ends_at?: string
          id?: string
          price_cents?: number
          request_fingerprint?: string | null
          request_id?: string
          service_id?: string
          service_name?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "bookings_employee_fkey"
            columns: ["business_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "bookings_service_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          role: Database["public"]["Enums"]["business_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_path: string | null
          name: string
          phone: string | null
          public_booking_enabled: boolean
          slot_interval_minutes: number
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name: string
          phone?: string | null
          public_booking_enabled?: boolean
          slot_interval_minutes?: number
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name?: string
          phone?: string | null
          public_booking_enabled?: boolean
          slot_interval_minutes?: number
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_blocked_periods: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
          ends_at: string
          id: string
          label: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
          ends_at: string
          id?: string
          label?: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
          ends_at?: string
          id?: string
          label?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_blocked_periods_employee_fkey"
            columns: ["business_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      employee_services: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
          service_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
          service_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_services_employee_fkey"
            columns: ["business_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "employee_services_service_fkey"
            columns: ["business_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      employee_working_hours: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
          end_minute: number
          id: string
          start_minute: number
          updated_at: string
          weekday: number
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
          end_minute: number
          id?: string
          start_minute: number
          updated_at?: string
          weekday: number
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
          end_minute?: number
          id?: string
          start_minute?: number
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_working_hours_employee_fkey"
            columns: ["business_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      employees: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_business_member_fkey"
            columns: ["business_id", "user_id"]
            isOneToOne: true
            referencedRelation: "business_members"
            referencedColumns: ["business_id", "user_id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_booking: {
        Args: {
          business_slug: string
          customer_email: string
          customer_name: string
          customer_phone?: string
          request_key: string
          requested_start: string
          target_employee_id: string
          target_service_id: string
        }
        Returns: Json
      }
      create_business: {
        Args: {
          business_name: string
          business_slug: string
          business_timezone?: string
        }
        Returns: string
      }
      get_availability_context: {
        Args: {
          target_business_id: string
          target_date: string
          target_employee_id: string
          target_service_id: string
        }
        Returns: Json
      }
      get_public_booking_availability: {
        Args: {
          target_business_slug: string
          target_date: string
          target_employee_id: string
          target_service_id: string
        }
        Returns: Json
      }
      get_public_booking_catalog: {
        Args: { target_business_slug: string }
        Returns: Json
      }
      list_business_members: {
        Args: { target_business_id: string }
        Returns: {
          email: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }[]
      }
      remove_business_member: {
        Args: { target_business_id: string; target_user_id: string }
        Returns: undefined
      }
      save_business_member: {
        Args: {
          member_email: string
          member_role: Database["public"]["Enums"]["business_role"]
          target_business_id: string
        }
        Returns: string
      }
      save_employee: {
        Args: {
          employee_name: string
          linked_user_id?: string
          service_ids: string[]
          target_business_id: string
          target_employee_id?: string
        }
        Returns: string
      }
      save_employee_working_hours: {
        Args: {
          periods: Json
          target_business_id: string
          target_employee_id: string
        }
        Returns: undefined
      }
      set_public_booking_enabled: {
        Args: { enabled: boolean; target_business_id: string }
        Returns: boolean
      }
    }
    Enums: {
      business_role: "owner" | "admin" | "employee"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      business_role: ["owner", "admin", "employee"],
    },
  },
} as const
