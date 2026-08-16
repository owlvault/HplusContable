import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // La regla se mantiene en error; el guion bajo es la forma de declarar
      // que algo no se usa a propósito: parámetros de una firma estable,
      // placeholders, o el campo que se descarta al hacer rest en un objeto.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // Advertencia y no error, a propósito.
      //
      // Los `any` que quedan cuelgan casi todos de que `createClient()` no está
      // tipado con el esquema: `src/types/database.ts` describe 4 tablas de las
      // ~35 que existen en Supabase, porque la mayoría se crearon directamente
      // allá y su DDL no está en el repositorio. Sin ese tipo, los resultados de
      // las consultas no tienen forma y hay que anotar los callbacks a mano.
      //
      // Escribir esas interfaces a mano sería peor que el `any`: parecerían
      // autoritativas y se desincronizarían del esquema real sin que nadie se
      // entere. El arreglo de verdad es generar el tipo desde la base
      // (`supabase gen types typescript`) y pasarlo a createServerClient; hasta
      // entonces esto queda como deuda visible en cada build en vez de como un
      // muro que impide compilar.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Artefactos de build y dependencias del sincronizador, que es un paquete
    // aparte con su propia configuración.
    ignores: [".next/**", "out/**", "tools/**/node_modules/**"],
  },
];

export default eslintConfig;
