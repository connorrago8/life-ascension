'use client';

import { CategoryBoard } from '../../../../components/ascension/CategoryBoard';

export default function PharmacyQuestsPage() {
  return <main className="wrap"><CategoryBoard only="pharmacy" limit={null} /></main>;
}
