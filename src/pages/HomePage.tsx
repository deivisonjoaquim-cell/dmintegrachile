import React, { useState } from 'react';
import { CalendlyModal } from '../components/CalendlyModal';
import { HomeSectionsView } from '../components/HomeSectionsView';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { useSeoMetadata } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { empresa, siteContent, partnersPublic, legalSources } = useApp();
  const { isEsCL, t } = useLanguage();
  const [lawModalOpen, setLawModalOpen] = useState(false);
  const [calendlyOpen, setCalendlyOpen] = useState(false);

  const heroSec = siteContent.find((s) => s.secao === 'hero');

  useSeoMetadata({
    title: isEsCL
      ? t.seo.homeTitle(empresa.nome_empresa)
      : heroSec?.seoTitulo || empresa.seoTituloPadrao || empresa.nome_empresa,
    description: isEsCL
      ? t.seo.homeDescription
      : heroSec?.seoDescricao || empresa.seoDescricaoPadrao || t.seo.homeDescription,
    orgName: empresa.nome_empresa,
    email: empresa.email,
    whatsapp: empresa.whatsapp,
  });

  return (
    <>
      <HomeSectionsView
        empresa={empresa}
        siteContent={siteContent}
        partnersPublic={partnersPublic}
        onNavigate={onNavigate}
        onOpenLawModal={() => setLawModalOpen(true)}
        onOpenCalendly={() => setCalendlyOpen(true)}
      />

      <CalendlyModal open={calendlyOpen} onClose={() => setCalendlyOpen(false)} />

      <LegalBaseModal
        open={lawModalOpen}
        onClose={() => setLawModalOpen(false)}
        title={t.seo.legalModalTitle}
        sources={legalSources}
        clientFriendlyOnly
      />
    </>
  );
};
