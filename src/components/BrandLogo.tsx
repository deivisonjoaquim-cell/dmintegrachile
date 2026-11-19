import React, { useId, useState } from 'react';

export type BrandLogoVariant = 'emblem' | 'emblem-dark' | 'full' | 'full-dark';

interface BrandLogoProps {
  /** URL personalizada cadastrada pelo admin (ex.: /uploads/... ou https://...). Quando vazia ou padrão, renderiza o vetor nativo instantaneamente. */
  src?: string | null;
  alt?: string;
  variant?: BrandLogoVariant;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_BUILTIN_PATHS = new Set([
  '/logo-dm-integra.svg',
  '/logo-dm-integra-dark.svg',
  '/logo-dm-integra-full.svg',
  'logo-dm-integra.svg',
  'logo-dm-integra-dark.svg',
  'logo-dm-integra-full.svg',
]);

function isCustomUploadedLogo(src?: string | null): src is string {
  const clean = (src || '').trim();
  if (!clean) return false;
  if (DEFAULT_BUILTIN_PATHS.has(clean)) return false;
  return true;
}

/**
 * Emblema vetorial oficial D&M Integra Chile – Relocation & Assessoria.
 * Renderizado inline em SVG com IDs isolados via useId() para garantir exibição
 * instantânea, nitidez em qualquer resolução (Retina/4K) e zero falhas de carregamento.
 * Quando o administrador carrega um arquivo personalizado, renderiza a imagem com
 * fallback automático para o emblema vetorial caso a URL fique indisponível.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  src,
  alt = 'D&M Integra Chile – Relocation & Assessoria',
  variant = 'emblem',
  className = 'h-10 w-auto',
  style,
}) => {
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9]/g, '');
  const [customFailed, setCustomFailed] = useState(false);

  const shouldUseCustomImg = isCustomUploadedLogo(src) && !customFailed && variant !== 'full' && variant !== 'full-dark';

  if (shouldUseCustomImg) {
    return (
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setCustomFailed(true)}
        className={className}
        style={style}
      />
    );
  }

  const isDark = variant === 'emblem-dark' || variant === 'full-dark';
  const isFull = variant === 'full' || variant === 'full-dark';

  const idGold = `dmG_${uid}`;
  const idGoldV = `dmGV_${uid}`;
  const idNavy = `dmN_${uid}`;
  const idEmerald = `dmE_${uid}`;
  const idCrimson = `dmC_${uid}`;
  const idSky = `dmS_${uid}`;
  const idClip = `dmClip_${uid}`;

  const renderEmblemMarkup = () => (
    <>
      <defs>
        <linearGradient id={idGold} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isDark ? '#FFF2BD' : '#F2DC8C'} />
          <stop offset="50%" stopColor={isDark ? '#E5C76B' : '#D4AF37'} />
          <stop offset="100%" stopColor={isDark ? '#B99226' : '#A6821E'} />
        </linearGradient>
        <linearGradient id={idGoldV} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={isDark ? '#FFF6CE' : '#F6E299'} />
          <stop offset="55%" stopColor={isDark ? '#E5C76B' : '#D4AF37'} />
          <stop offset="100%" stopColor={isDark ? '#B89124' : '#9A7618'} />
        </linearGradient>
        <linearGradient id={idNavy} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isDark ? '#27537A' : '#193B57'} />
          <stop offset="100%" stopColor={isDark ? '#0F2537' : '#0B1F33'} />
        </linearGradient>
        <linearGradient id={idEmerald} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isDark ? '#27A15E' : '#1E824C'} />
          <stop offset="100%" stopColor={isDark ? '#146B43' : '#0F4D2F'} />
        </linearGradient>
        <linearGradient id={idCrimson} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isDark ? '#EA3B4C' : '#D62839'} />
          <stop offset="100%" stopColor={isDark ? '#B31E2D' : '#991B26'} />
        </linearGradient>
        <linearGradient id={idSky} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={isDark ? '#132D44' : '#FFFFFF'} />
          <stop offset="100%" stopColor={isDark ? '#091826' : '#EEF3F8'} />
        </linearGradient>
        <clipPath id={idClip}>
          <circle cx="120" cy="124" r="88" />
        </clipPath>
      </defs>

      {/* Medalhão circular principal */}
      <circle cx="120" cy="124" r="96" fill={`url(#${idSky})`} />

      {/* Arcos externos bilaterais — Brasil (Esmeralda/Dourado) & Chile (Carmim/Azul Marinho) */}
      <path
        d="M 103 25 A 100 100 0 0 0 38 182"
        fill="none"
        stroke={`url(#${idEmerald})`}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <path
        d="M 103 33 A 92 92 0 0 0 44 176"
        fill="none"
        stroke={`url(#${idGold})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M 137 25 A 100 100 0 0 1 202 182"
        fill="none"
        stroke={`url(#${idCrimson})`}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <path
        d="M 137 33 A 92 92 0 0 1 196 176"
        fill="none"
        stroke={isDark ? '#7FAAD1' : `url(#${idNavy})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity={isDark ? 0.78 : 1}
      />

      {/* Fechamento dourado inferior */}
      <path
        d="M 52 197 A 99 99 0 0 0 188 197"
        fill="none"
        stroke={`url(#${idGold})`}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <polygon points="120,217 125,223 120,229 115,223" fill={`url(#${idGold})`} />

      {/* Cena interna recortada no círculo */}
      <g clipPath={`url(#${idClip})`}>
        {/* Raios solares sutis atrás da Cordilheira dos Andes */}
        <g stroke={`url(#${idGold})`} strokeWidth="1.6" strokeLinecap="round" opacity={isDark ? 0.45 : 0.55}>
          <line x1="120" y1="62" x2="120" y2="42" />
          <line x1="104" y1="68" x2="94" y2="49" />
          <line x1="136" y1="68" x2="146" y2="49" />
          <line x1="90" y1="78" x2="74" y2="62" />
          <line x1="150" y1="78" x2="166" y2="62" />
          <line x1="78" y1="92" x2="60" y2="82" />
          <line x1="162" y1="92" x2="180" y2="82" />
        </g>

        {/* Cordilheira dos Andes — Pico esquerdo */}
        <polygon points="34,154 78,86 116,154" fill={`url(#${idNavy})`} />
        <polygon points="78,86 92,110 83,107 78,113 72,107 65,112" fill="#FFFFFF" />

        {/* Cordilheira dos Andes — Pico direito */}
        <polygon points="124,154 162,90 206,154" fill={`url(#${idEmerald})`} />
        <polygon points="162,90 175,112 167,108 162,114 156,108 149,113" fill="#FFFFFF" />

        {/* Cordilheira dos Andes — Pico central dominante */}
        <polygon points="62,158 120,62 178,158" fill={`url(#${idNavy})`} />
        <polygon points="120,62 178,158 128,158 118,108" fill={`url(#${idEmerald})`} opacity="0.92" />
        <polygon points="120,62 138,94 128,89 120,99 112,90 102,96" fill="#FFFFFF" />

        {/* Casa acolhedora (Relocation & Novo Lar) */}
        <path d="M 120 112 L 138 125 L 138 148 L 102 148 L 102 125 Z" fill="#FFFFFF" />
        <path d="M 120 109 L 141 124.5 L 138 128 L 120 114.5 L 102 128 L 99 124.5 Z" fill={`url(#${idNavy})`} />
        <rect x="115" y="131" width="10" height="17" rx="1.5" fill={`url(#${idNavy})`} />
        <circle cx="122.5" cy="139.5" r="1.15" fill={`url(#${idGold})`} />

        {/* Base clara e faixas fluidas Brasil + Chile */}
        <path d="M 28 156 Q 120 132 212 156 L 212 220 L 28 220 Z" fill={isDark ? '#0D2235' : '#FFFFFF'} />

        {/* Fita Brasil (Esquerda: Esmeralda + Dourado) */}
        <path d="M 28 161 Q 78 143 116 154 Q 90 165 62 198 L 28 190 Z" fill={`url(#${idEmerald})`} />
        <path d="M 32 178 Q 76 156 112 158 Q 88 175 68 208 L 36 202 Z" fill={`url(#${idGold})`} />
        <path d="M 52 204 Q 82 171 116 157 Q 100 179 88 214 L 58 214 Z" fill={`url(#${idEmerald})`} opacity="0.94" />

        {/* Fita Chile (Direita: Azul Marinho + Branco + Carmim) */}
        <path d="M 212 156 Q 162 141 122 155 Q 156 154 212 169 Z" fill={`url(#${idNavy})`} />
        <path d="M 212 169 Q 158 154 121 159 Q 154 166 206 186 Z" fill="#F8FAFC" />
        <path d="M 206 184 Q 156 164 119 162 Q 146 178 178 214 L 212 204 Z" fill={`url(#${idCrimson})`} />

        {/* Caminho central luminoso */}
        <path d="M 96 216 Q 112 178 120 148 Q 128 178 144 216 Z" fill="#FFFFFF" opacity="0.95" />
        <path d="M 105 216 Q 115 182 120 152 Q 125 182 135 216 Z" fill={`url(#${idGold})`} opacity="0.28" />
      </g>

      {/* Anel interno dourado */}
      <circle
        cx="120"
        cy="124"
        r="88.5"
        fill="none"
        stroke={`url(#${idGold})`}
        strokeWidth="1.5"
        opacity={isDark ? 0.85 : 0.72}
      />

      {/* Estrela Guia coroando a Cordilheira */}
      <g transform="translate(120, 29)">
        <circle cx="0" cy="0" r="14" fill={isDark ? '#0B1B29' : '#FFFFFF'} opacity="0.92" />
        <polygon
          points="0,-11 3,-3 11,0 3,3 0,11 -3,3 -11,0 -3,-3"
          fill={`url(#${idGold})`}
          transform="rotate(45)"
          opacity="0.9"
        />
        <polygon points="0,-19 4,-4 19,0 4,4 0,19 -4,4 -19,0 -4,-4" fill={`url(#${idGoldV})`} />
        <polygon points="0,-19 4,-4 0,0" fill="#FFF7D6" opacity="0.88" />
        <polygon points="0,0 19,0 4,4" fill="#A6821E" opacity="0.45" />
      </g>
    </>
  );

  if (isFull) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 560 190"
        role="img"
        aria-label={alt}
        className={className}
        style={style}
      >
        <g transform="translate(10, 6) scale(0.76)">{renderEmblemMarkup()}</g>
        <line
          x1="205"
          y1="38"
          x2="205"
          y2="152"
          stroke={`url(#${idGold})`}
          strokeWidth="1.5"
          opacity="0.65"
        />
        <text
          x="226"
          y="78"
          fontFamily="'Playfair Display', Georgia, serif"
          fontWeight="700"
          fontSize="44"
          letterSpacing="3"
          fill={isDark ? '#FFFFFF' : '#0B1F33'}
        >
          D&amp;M
        </text>
        <text
          x="226"
          y="115"
          fontFamily="'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif"
          fontWeight="800"
          fontSize="27"
          letterSpacing="2.2"
          fill={isDark ? '#E2E8F0' : '#0B1F33'}
        >
          INTEGRA{' '}
          <tspan fill={isDark ? '#5CD48D' : '#146B43'}>CHILE</tspan>
        </text>
        <text
          x="228"
          y="144"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontWeight="600"
          fontSize="12.5"
          letterSpacing="3.2"
          fill={isDark ? '#E5C76B' : '#7C6219'}
        >
          RELOCATION &amp; ASSESSORIA
        </text>
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 240"
      role="img"
      aria-label={alt}
      className={className}
      style={style}
    >
      {renderEmblemMarkup()}
    </svg>
  );
};

/**
 * Filete arquitetônico bilateral (Esmeralda Brasil · Dourado · Marinho Andino · Carmim Chile)
 * derivado diretamente dos arcos da logo oficial D&M Integra Chile.
 */
export const BrandRibbon: React.FC<{ className?: string }> = ({ className = 'h-[2.5px] w-full' }) => (
  <div className={`brand-ribbon shrink-0 ${className}`} aria-hidden="true" />
);

/**
 * Assinatura tipográfica oficial derivada da logo:
 * "D&M" em Playfair Display serifada + "INTEGRA" em Marinho/Branco + "CHILE" em Esmeralda Brasil.
 */
export const BrandWordmark: React.FC<{
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
}> = ({
  tone = 'light',
  size = 'md',
  showSubtitle = false,
  subtitle = 'Relocation & Assessoria',
  className = '',
}) => {
  const isDark = tone === 'dark';
  const dmSize =
    size === 'sm' ? 'text-[17px]' : size === 'lg' ? 'text-[26px]' : 'text-[21px]';
  const nameSize =
    size === 'sm' ? 'text-[13.5px]' : size === 'lg' ? 'text-[19px]' : 'text-[16px]';
  const subSize =
    size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-[12px]' : 'text-[11px]';

  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span
          className={`font-brand-serif font-bold tracking-tight ${dmSize} ${
            isDark ? 'text-white' : 'text-[#0B1F33]'
          }`}
        >
          D&amp;M
        </span>
        <span
          className={`font-brand-sans font-extrabold tracking-[0.04em] ${nameSize} ${
            isDark ? 'text-slate-100' : 'text-[#0B1F33]'
          }`}
        >
          INTEGRA{' '}
          <span className={isDark ? 'text-[#5CD48D]' : 'text-[#146B43]'}>CHILE</span>
        </span>
      </span>
      {showSubtitle && (
        <span
          className={`font-brand-sans font-semibold tracking-[0.14em] mt-1 whitespace-nowrap ${subSize} ${
            isDark ? 'text-[#E5C76B]' : 'text-[#8C6D14]'
          }`}
        >
          {subtitle}
        </span>
      )}
    </span>
  );
};

