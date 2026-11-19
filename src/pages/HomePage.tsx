import React, { useState } from 'react';
import { CalendlyModal } from '../components/CalendlyModal';
import { HomeSectionsView } from '../components/HomeSectionsView';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { useSeoMetadata } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { empresa, siteContent, partnersPublic, legalSources } = useApp();
  const [lawModalOpen, setLawModalOpen] = useState(false);
  const [calendlyOpen, setCalendlyOpen] = useState(false);

  const heroSec = siteContent.find((s) => s.secao === 'hero');

  useSeoMetadata({
    title: heroSec?.seoTitulo || empresa.seoTituloPadrao || `${empresa.nome_empresa}`,
    description:
      heroSec?.seoDescricao ||
      empresa.seoDescricaoPadrao ||
      'Assessoria especializada em imigração, Acordo Mercosul, Residência Temporal e Definitiva no Chile.',
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
        title="Legislação Chilena, Brasileira e Mercosul — em linguagem clara"
        sources={legalSources}
        clientFriendlyOnly
      />
    </>
  );
};
