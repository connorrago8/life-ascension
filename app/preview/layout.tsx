import type { ReactNode } from 'react';
import './preview.css';
import { PreviewFrame } from '../../components/preview/PreviewFrame';

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return <PreviewFrame>{children}</PreviewFrame>;
}
