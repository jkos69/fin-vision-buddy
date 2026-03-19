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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_passwords: {
        Row: {
          area: string | null
          created_at: string | null
          diretoria: string | null
          id: string
          nome_display: string
          responsavel: string | null
          senha: string
          senha_hash: string | null
          tipo: string
        }
        Insert: {
          area?: string | null
          created_at?: string | null
          diretoria?: string | null
          id?: string
          nome_display: string
          responsavel?: string | null
          senha: string
          senha_hash?: string | null
          tipo: string
        }
        Update: {
          area?: string | null
          created_at?: string | null
          diretoria?: string | null
          id?: string
          nome_display?: string
          responsavel?: string | null
          senha?: string
          senha_hash?: string | null
          tipo?: string
        }
        Relationships: []
      }
      active_sessions: {
        Row: {
          area: string | null
          created_at: string | null
          diretoria: string | null
          expires_at: string | null
          id: string
          session_token: string
          tipo: string
        }
        Insert: {
          area?: string | null
          created_at?: string | null
          diretoria?: string | null
          expires_at?: string | null
          id?: string
          session_token: string
          tipo: string
        }
        Update: {
          area?: string | null
          created_at?: string | null
          diretoria?: string | null
          expires_at?: string | null
          id?: string
          session_token?: string
          tipo?: string
        }
        Relationships: []
      }
      opex_records: {
        Row: {
          agrupamento: string | null
          area_grupo1: string
          base: string
          centro_custo: string | null
          conta_contabil: string | null
          credito: number | null
          data_lcto: string | null
          debito: number | null
          desc_pedido: string | null
          descr_origem: string | null
          descricao_ccusto: string | null
          descricao_conta: string | null
          diretoria: string
          executado: number | null
          fornecedor_gerencial: string | null
          historico: string | null
          id: number
          mes: number
          nome_fornecedor: string | null
          numero_lote: string | null
          origem: string | null
          pacote: string
          recurso: string
          responsavel_area: string | null
          tipo: string | null
          upload_id: string | null
        }
        Insert: {
          agrupamento?: string | null
          area_grupo1: string
          base: string
          centro_custo?: string | null
          conta_contabil?: string | null
          credito?: number | null
          data_lcto?: string | null
          debito?: number | null
          desc_pedido?: string | null
          descr_origem?: string | null
          descricao_ccusto?: string | null
          descricao_conta?: string | null
          diretoria: string
          executado?: number | null
          fornecedor_gerencial?: string | null
          historico?: string | null
          id?: number
          mes: number
          nome_fornecedor?: string | null
          numero_lote?: string | null
          origem?: string | null
          pacote: string
          recurso: string
          responsavel_area?: string | null
          tipo?: string | null
          upload_id?: string | null
        }
        Update: {
          agrupamento?: string | null
          area_grupo1?: string
          base?: string
          centro_custo?: string | null
          conta_contabil?: string | null
          credito?: number | null
          data_lcto?: string | null
          debito?: number | null
          desc_pedido?: string | null
          descr_origem?: string | null
          descricao_ccusto?: string | null
          descricao_conta?: string | null
          diretoria?: string
          executado?: number | null
          fornecedor_gerencial?: string | null
          historico?: string | null
          id?: number
          mes?: number
          nome_fornecedor?: string | null
          numero_lote?: string | null
          origem?: string | null
          pacote?: string
          recurso?: string
          responsavel_area?: string | null
          tipo?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opex_records_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "opex_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      opex_uploads: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          meses_real: number[] | null
          total_orcado: number | null
          total_realizado: number | null
          total_records: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          meses_real?: number[] | null
          total_orcado?: number | null
          total_realizado?: number | null
          total_records: number
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          meses_real?: number[] | null
          total_orcado?: number | null
          total_realizado?: number | null
          total_records?: number
          uploaded_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_opex_data: { Args: { p_session_token: string }; Returns: boolean }
      create_session: {
        Args: { input_senha: string }
        Returns: {
          area: string
          diretoria: string
          nome_display: string
          responsavel: string
          session_token: string
          tipo: string
        }[]
      }
      destroy_session: { Args: { p_session_token: string }; Returns: boolean }
      insert_opex_batch: {
        Args: { p_records: Json; p_session_token: string }
        Returns: number
      }
      insert_opex_upload: {
        Args: {
          p_filename: string
          p_meses_real: number[]
          p_session_token: string
          p_total_orcado: number
          p_total_realizado: number
          p_total_records: number
          p_uploaded_by: string
        }
        Returns: string
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
