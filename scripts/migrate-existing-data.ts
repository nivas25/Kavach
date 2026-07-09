import * as fs from 'fs';
import * as path from 'path';

const CORE_LEGAL_FILE = path.resolve(__dirname, '../data/qdrant-seed/core_legal_sections.json');
const RISK_PATTERNS_FILE = path.resolve(__dirname, '../data/qdrant-seed/risk_patterns.json');
const INDUSTRY_BENCHMARKS_FILE = path.resolve(__dirname, '../data/qdrant-seed/industry_benchmarks.json');

function migrateCoreLegal() {
  console.log('Migrating core_legal_sections...');
  const data = JSON.parse(fs.readFileSync(CORE_LEGAL_FILE, 'utf-8'));
  
  const migrated = data.map((entry: any) => {
    if (entry.enforceability_status) return entry;
    
    let status = 'Binding and Enforceable';
    if (entry.type === 'statute') status = 'Strictly Enforceable Statute';
    if (entry.type === 'precedent') status = 'Binding Judicial Precedent';
    
    return {
      ...entry,
      enforceability_status: status
    };
  });
  
  fs.writeFileSync(CORE_LEGAL_FILE, JSON.stringify(migrated, null, 2));
  console.log(`✅ Migrated ${migrated.length} entries in core_legal_sections`);
}

function migrateRiskPatterns() {
  console.log('Migrating risk_patterns...');
  const data = JSON.parse(fs.readFileSync(RISK_PATTERNS_FILE, 'utf-8'));
  
  const migrated = data.map((entry: any) => {
    const isMigrated = entry.safer_alternative && entry.negotiation_script;
    if (isMigrated) return entry;
    
    const safer_alternative = entry.what_to_look_for 
      ? `Alternative: ${entry.what_to_look_for}` 
      : 'Seek mutual and balanced terms.';
      
    const lawRef = entry.indian_law_reference && entry.indian_law_reference !== 'None' 
      ? ` As per ${entry.indian_law_reference}, this is highly irregular.`
      : '';
      
    const negotiation_script = `I noticed the ${entry.pattern_name.toLowerCase()} clause is quite broad.${lawRef} Could we revise this to be more balanced?`;
    
    return {
      ...entry,
      safer_alternative,
      negotiation_script
    };
  });
  
  fs.writeFileSync(RISK_PATTERNS_FILE, JSON.stringify(migrated, null, 2));
  console.log(`✅ Migrated ${migrated.length} entries in risk_patterns`);
}

function migrateIndustryBenchmarks() {
  console.log('Migrating industry_benchmarks...');
  const data = JSON.parse(fs.readFileSync(INDUSTRY_BENCHMARKS_FILE, 'utf-8'));
  
  const migrated = data.map((entry: any) => {
    const isMigrated = entry.risk_if_exceeded && entry.recommended_clause_language && entry.red_flag_language;
    if (isMigrated) return entry;
    
    return {
      ...entry,
      risk_if_exceeded: 'Deviating from this standard introduces asymmetric risk and potential exploitation.',
      recommended_clause_language: 'Language should strictly reflect the standard practice without hidden contingencies.',
      red_flag_language: 'Watch for absolute terms ("perpetual", "uncapped", "sole discretion") that bypass the standard.'
    };
  });
  
  fs.writeFileSync(INDUSTRY_BENCHMARKS_FILE, JSON.stringify(migrated, null, 2));
  console.log(`✅ Migrated ${migrated.length} entries in industry_benchmarks`);
}

function main() {
  migrateCoreLegal();
  migrateRiskPatterns();
  migrateIndustryBenchmarks();
  console.log('Migration complete!');
}

main();
