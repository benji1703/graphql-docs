import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <div className="empty-page"><span>404</span><h1>That definition isn’t in this schema.</h1><p>It may have moved, been removed, or belong to another graph.</p><Link className="button button--primary" to="/"><ArrowLeft size={16} /> Back to overview</Link></div>;
}
