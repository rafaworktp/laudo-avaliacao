/* Configuração do sistema de laudo.
   Edite os campos abaixo e publique a pasta. Não coloque segredos aqui. */
window.LAUDO_CONFIG = {
  empresa: 'Avaliações Imobiliárias',
  engenheiro: 'Kathleen Alexandra Goulart',
  cidade: 'Três Pontas/MG',
  whatsapp: '',        // Ex.: 5535999999999 (DDI + DDD + número)
  apiUrl: '',          // Opcional: endpoint legado que recebe o JSON do cliente (POST)
  serverUrl: '',       // Opcional: URL pública do servidor Node, se usado no modo local

  /* Nuvem (Supabase) — chave pública, protegida por RLS no banco.
     Não coloque a chave service_role neste arquivo. */
  supabase: {
    url: 'https://vztgdmxjykipuzdovbld.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6dGdkbXhqeWtpcHV6ZG92YmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2NTQ5MzEsImV4cCI6MjExMTIzMDkzMX0.VnQK7QimXrRKcpAvBxEFM569WcFK9MkQhyj2Obmytmo',
    adminEmail: 'kathleengoulart@hotmail.com'
  }
};
