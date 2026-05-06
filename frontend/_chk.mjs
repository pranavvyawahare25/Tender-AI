import { parse } from '@babel/parser';
import { readFileSync } from 'fs';
const files = [
  'src/App.jsx','src/main.jsx',
  'src/contexts/AuthContext.jsx',
  'src/utils/api.js','src/utils/helpers.js',
  'src/pages/LandingPage.jsx','src/pages/LoginPage.jsx',
  'src/pages/BidderPortal.jsx','src/pages/EvaluatorDashboard.jsx',
  'src/components/AdminGuard.jsx','src/components/Layout.jsx',
  'src/components/AdminOverview.jsx','src/components/TenderDetail.jsx',
  'src/components/TenderInsights.jsx','src/components/NewTenderModal.jsx',
  'src/components/RiskRadar.jsx','src/components/ComparisonMatrix.jsx',
  'src/components/EligibilityFunnel.jsx','src/components/ActivityTimeline.jsx',
  'src/components/CountUp.jsx','src/components/BidderUpload.jsx',
  'src/components/TenderUpload.jsx','src/components/CriteriaList.jsx',
  'src/components/Summary.jsx','src/components/AuditLog.jsx',
  'src/components/BidderCard.jsx',
];
let bad = 0;
for (const f of files) {
  try { parse(readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); console.log('OK ', f); }
  catch (e) { bad++; console.log('FAIL', f, e.message); }
}
process.exit(bad);
