const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    const totalVotesEl = document.getElementById('totalVotes');
    const leaderboardBody = document.getElementById('leaderboardBody');
    const loadingPanel = document.getElementById('loadingPanel');
    const leaderboardTable = document.getElementById('leaderboardTable');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Configurações
    const dataEncerramentoInput = document.getElementById('dataEncerramentoInput');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const configStatus = document.getElementById('configStatus');

    // Carregar configuração atual
    async function loadConfig() {
        try {
            const { data, error } = await supabaseClient
                .from('configuracoes')
                .select('valor')
                .eq('chave', 'data_encerramento')
                .maybeSingle(); // maybeSingle não dá erro se não existir a linha
            
            if (data && data.valor) {
                dataEncerramentoInput.value = data.valor;
            }
        } catch (e) {
            console.error('Erro ao carregar configuração:', e);
        }
    }

    // Salvar configuração
    saveConfigBtn.addEventListener('click', async () => {
        saveConfigBtn.textContent = 'Salvando...';
        saveConfigBtn.disabled = true;
        try {
            const novaData = dataEncerramentoInput.value;
            const { error } = await supabaseClient
                .from('configuracoes')
                .upsert([ { chave: 'data_encerramento', valor: novaData } ], { onConflict: 'chave' });
            
            if (error) throw error;
            
            configStatus.style.display = 'block';
            setTimeout(() => configStatus.style.display = 'none', 3000);
        } catch (e) {
            console.error('Erro ao salvar configuração:', e);
            alert('Erro ao salvar. Verifique se a tabela configuracoes existe.');
        } finally {
            saveConfigBtn.textContent = 'Salvar Data';
            saveConfigBtn.disabled = false;
        }
    });

    async function loadResults() {
        loadingPanel.classList.remove('hidden');
        leaderboardTable.classList.add('hidden');
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Atualizando...';

        try {
            // Buscar todas as candidatas (com dados completos)
            const { data: candidatas, error: candidatasError } = await supabaseClient
                .from('candidatas')
                .select('id, nome, localidade, fotos_urls, idade, contato, autorizacao_url');

            if (candidatasError) throw candidatasError;

            // Buscar todos os votos
            const { data: votos, error: votosError } = await supabaseClient
                .from('votos')
                .select('candidata_id');

            if (votosError) throw votosError;

            const totalVotos = votos.length;
            totalVotesEl.textContent = totalVotos;

            // Contar votos por candidata
            const voteCounts = {};
            votos.forEach(v => {
                voteCounts[v.candidata_id] = (voteCounts[v.candidata_id] || 0) + 1;
            });

            // Mapear resultados e calcular porcentagem
            const results = candidatas.map(c => {
                const votosRecebidos = voteCounts[c.id] || 0;
                const percentual = totalVotos > 0 ? ((votosRecebidos / totalVotos) * 100).toFixed(1) : 0;
                return {
                    ...c,
                    votos: votosRecebidos,
                    percentual: percentual
                };
            });

            // Ordenar por quantidade de votos (decrescente)
            results.sort((a, b) => b.votos - a.votos);

            // Renderizar tabela
            leaderboardBody.innerHTML = '';
            results.forEach((c, index) => {
                const tr = document.createElement('tr');
                
                // Ícones para o TOP 3
                let medal = '';
                if (index === 0) medal = '🥇 ';
                if (index === 1) medal = '🥈 ';
                if (index === 2) medal = '🥉 ';

                const fotoUrl = (c.fotos_urls && c.fotos_urls.length > 0) ? c.fotos_urls[0] : 'https://via.placeholder.com/40';

                tr.innerHTML = `
                    <td class="posicao-col">${medal}${index + 1}º</td>
                    <td>
                        <div class="candidata-col">
                            <img src="${fotoUrl}" alt="${c.nome}">
                            <strong>${c.nome}</strong>
                        </div>
                    </td>
                    <td>${c.localidade}</td>
                    <td class="votos-col">${c.votos}</td>
                    <td class="percent-col">${c.percentual}%</td>
                `;
                leaderboardBody.appendChild(tr);
            });

            // Renderizar tabela de Inscrições (Dados Completos)
            const inscricoesBody = document.getElementById('inscricoesBody');
            const inscricoesTable = document.getElementById('inscricoesTable');
            
            inscricoesBody.innerHTML = '';
            // Ordenar por nome
            const candidatasOrdenadas = [...candidatas].sort((a, b) => a.nome.localeCompare(b.nome));
            
            candidatasOrdenadas.forEach(c => {
                const tr = document.createElement('tr');
                const fotoUrl = (c.fotos_urls && c.fotos_urls.length > 0) ? c.fotos_urls[0] : 'https://via.placeholder.com/40';
                
                let authStatus = '';
                if (c.idade < 18) {
                    if (c.autorizacao_url) {
                        authStatus = `<a href="${c.autorizacao_url}" target="_blank" style="color: #10b981; font-weight: bold; text-decoration: none;">✅ Ver Autorização</a>`;
                    } else {
                        authStatus = `<span style="color: var(--error); font-weight: bold;">❌ Pendente</span>`;
                    }
                } else {
                    authStatus = `<span style="color: var(--text-muted);">Maior de Idade</span>`;
                }

                tr.innerHTML = `
                    <td>
                        <div class="candidata-col">
                            <a href="${fotoUrl}" target="_blank" title="Ver foto em tamanho real">
                                <img src="${fotoUrl}" alt="${c.nome}">
                            </a>
                            <strong>${c.nome}</strong>
                        </div>
                    </td>
                    <td style="font-weight: bold; color: ${c.idade < 18 ? 'var(--primary)' : 'inherit'};">${c.idade}</td>
                    <td><a href="https://wa.me/55${c.contato.replace(/\\D/g, '')}" target="_blank" style="color: var(--text-main); text-decoration: none;">${c.contato}</a></td>
                    <td>${c.localidade}</td>
                    <td>${authStatus}</td>
                `;
                inscricoesBody.appendChild(tr);
            });

            loadingPanel.classList.add('hidden');
            leaderboardTable.classList.remove('hidden');
            inscricoesTable.classList.remove('hidden');

        } catch (error) {
            console.error('Erro ao carregar resultados:', error);
            alert('Erro ao carregar os dados. Verifique a conexão com o banco de dados. Você já criou a tabela votos?');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Atualizar Resultados';
        }
    }

    refreshBtn.addEventListener('click', loadResults);

    // Configurar atualização em tempo real (Realtime do Supabase)
    supabaseClient
        .channel('votos_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votos' }, (payload) => {
            console.log('Novo voto detectado em tempo real!', payload);
            // Mostrar um pequeno feedback visual no botão
            const oldText = refreshBtn.textContent;
            refreshBtn.textContent = 'Novo voto! Atualizando...';
            refreshBtn.style.background = '#10b981';
            
            loadResults().then(() => {
                setTimeout(() => {
                    refreshBtn.textContent = 'Atualização em Tempo Real Ativa 🟢';
                    refreshBtn.style.background = 'var(--primary)';
                }, 2000);
            });
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                refreshBtn.textContent = 'Atualização em Tempo Real Ativa 🟢';
            }
        });

    // Carregar na inicialização
    loadConfig();
    loadResults();
});
