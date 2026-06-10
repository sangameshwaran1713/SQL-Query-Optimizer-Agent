import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import Pipeline from '../components/Pipeline';

export default function HomePage() {
  const navigate = useNavigate();

  const goToOptimizer = (e) => {
    if (e) e.preventDefault();
    navigate('/optimizer-agent');
  };

  return (
    <div className="bg-brand-bg">
      <Hero goToOptimizer={goToOptimizer} />
      <Pipeline />
    </div>
  );
}
