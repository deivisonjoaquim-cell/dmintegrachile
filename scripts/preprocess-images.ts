#!/usr/bin/env tsx
/**
 * Script automático de pré-processamento de imagens para WebP.
 *
 * Converte fotos editoriais, ativos de marca e uploads raster (JPG/PNG) para WebP
 * otimizado (incluindo variantes 640w para celular) a fim de manter o carregamento
 * mobile abaixo de 2 segundos.
 *
 * Uso:
 *   npm run optimize:images
 *   npm run optimize:images -- --force
 *   npm run optimize:images -- --uploads-only
 */
import path from 'node:path';
import {
  preprocessAssetDirectoryToWebp,
  type DirectoryPreprocessOptions,
  type DirectoryPreprocessReport,
} from '../server/imagePreprocessor.ts';

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const force = args.has('--force');
  const uploadsOnly = args.has('--uploads-only');
  const root = process.cwd();

  const targets: { label: string; options: DirectoryPreprocessOptions }[] = [];

  if (!uploadsOnly) {
    targets.push(
      {
        label: 'Fotos editoriais (src/assets/images)',
        options: {
          dir: path.resolve(root, 'src/assets/images'),
          preserveOriginals: true,
          generateMobileVariant: true,
          maxWidth: 1280,
          mobileWidth: 640,
          quality: 82,
          mobileQuality: 80,
          force,
        },
      },
      {
        label: 'Ativos de marca (public/assets/aistudio)',
        options: {
          dir: path.resolve(root, 'public/assets/aistudio'),
          preserveOriginals: true,
          generateMobileVariant: false,
          maxWidth: 1200,
          quality: 86,
          force,
        },
      },
    );
  }

  targets.push({
    label: 'Uploads enviados (uploads)',
    options: {
      dir: path.resolve(root, 'uploads'),
      preserveOriginals: false,
      generateMobileVariant: true,
      maxWidth: 1280,
      mobileWidth: 640,
      quality: 82,
      mobileQuality: 80,
      force,
    },
  });

  let grandOriginal = 0;
  let grandWebp = 0;
  let grandMobile = 0;
  let grandProcessed = 0;
  let grandSkipped = 0;

  const reports: { label: string; report: DirectoryPreprocessReport }[] = [];
  for (const target of targets) {
    const report = await preprocessAssetDirectoryToWebp(target.options);
    reports.push({ label: target.label, report });
    grandOriginal += report.totalOriginalBytes;
    grandWebp += report.totalWebpBytes;
    grandMobile += report.totalMobileBytes;
    grandProcessed += report.processedCount;
    grandSkipped += report.skippedCount;
  }

  console.log('\n[WebP Preprocessor] Resumo de otimização de ativos:');
  for (const { label, report } of reports) {
    if (report.items.length === 0) {
      console.log(`  - ${label}: nenhum ativo raster pendente.`);
      continue;
    }
    const savingPct =
      report.totalOriginalBytes > 0
        ? Math.round(((report.totalOriginalBytes - report.totalMobileBytes) / report.totalOriginalBytes) * 100)
        : 0;
    console.log(
      `  - ${label}: ${report.processedCount} convertido(s), ${report.skippedCount} atualizado(s) | Original ${formatKb(report.totalOriginalBytes)} -> Mobile WebP ${formatKb(report.totalMobileBytes)} (-${savingPct}%)`,
    );
  }

  const totalSavingPct =
    grandOriginal > 0 ? Math.round(((grandOriginal - grandMobile) / grandOriginal) * 100) : 0;
  console.log(
    `[WebP Preprocessor] Concluído: ${grandProcessed} convertido(s), ${grandSkipped} já otimizado(s). Economia mobile total: -${totalSavingPct}% (${formatKb(grandOriginal)} -> ${formatKb(grandMobile)}).\n`,
  );
}

main().catch((err) => {
  console.error('[WebP Preprocessor] Falha ao processar imagens:', err instanceof Error ? err.message : err);
  process.exit(1);
});
