-- Función RPC para obtener el siguiente número de factura de forma atómica
-- Ejecutar este SQL en el Supabase Dashboard -> SQL Editor

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_prefix text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_number integer;
    v_doc_type text;
BEGIN
    -- Determinar el tipo de documento basado en el prefijo
    v_doc_type := CASE 
        WHEN p_prefix = 'FV' THEN 'FACTURA_VENTA'
        WHEN p_prefix = 'FC' THEN 'FACTURA_COMPRA'
        ELSE 'DOCUMENTO'
    END;

    -- Intentar actualizar y obtener el nuevo número en una sola operación atómica
    -- SELECT FOR UPDATE bloquea la fila hasta que termine la transacción
    UPDATE document_sequences 
    SET current_number = current_number + 1, updated_at = now()
    WHERE prefix = p_prefix
    RETURNING current_number INTO v_next_number;

    -- Si no existe el registro, crearlo con número 1
    IF v_next_number IS NULL THEN
        INSERT INTO document_sequences (document_type, prefix, current_number, is_active, created_at, updated_at)
        VALUES (v_doc_type, p_prefix, 1, true, now(), now())
        ON CONFLICT (prefix) DO UPDATE 
            SET current_number = document_sequences.current_number + 1, updated_at = now()
        RETURNING current_number INTO v_next_number;
    END IF;

    RETURN v_next_number;
END;
$$;

-- Asignar permisos
GRANT EXECUTE ON FUNCTION get_next_invoice_number(text) TO authenticated;

-- Comentario sobre la función
COMMENT ON FUNCTION get_next_invoice_number IS 'Obtiene el siguiente número de factura de forma atómica, evitando race conditions';
