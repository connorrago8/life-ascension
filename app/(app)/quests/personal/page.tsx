'use client';

import { CategoryBoard } from '../../../../components/ascension/CategoryBoard';

export default function PersonalQuestsPage() {
  return <main className="wrap"><CategoryBoard only="personal" limit={null} /></main>;
}