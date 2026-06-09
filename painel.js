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
                .select('id, nome, cpf, localidade, fotos_urls, idade, contato, autorizacao_url, video_url, mora_paraipaba, aprovada');

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

            // Renderizar tabela de Inscrições (Dados Completos) e Vídeos
            const inscricoesBody = document.getElementById('inscricoesBody');
            const inscricoesTable = document.getElementById('inscricoesTable');
            const videosGrid = document.getElementById('videosGrid');
            
            inscricoesBody.innerHTML = '';
            videosGrid.innerHTML = '';
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

                let parentescoStatus = '';
                if (c.mora_paraipaba === 'nao') {
                    parentescoStatus = `<span style="color: #f59e0b; font-size: 0.85rem; font-weight: bold;">Não (Checar Vídeo)</span>`;
                } else {
                    parentescoStatus = `<span style="color: var(--text-muted); font-size: 0.85rem;">Sim</span>`;
                }

                // Vídeos e Apresentação
                if (c.video_url || (c.idade < 18 && c.autorizacao_url)) {
                    const videoCard = document.createElement('div');
                    videoCard.style = "background: var(--card-bg); padding: 15px; border-radius: 12px; border: 1px solid var(--card-border); display: flex; flex-direction: column; gap: 10px;";
                    
                    let videoHtml = c.video_url ? `
                        <video controls style="width: 100%; border-radius: 8px; background: #000; max-height: 250px;">
                            <source src="${c.video_url}" type="video/mp4">
                            Seu navegador não suporta vídeos.
                        </video>` : '<div style="background: var(--body-bg); padding: 20px; text-align: center; border-radius: 8px; font-size: 0.9rem; color: var(--text-muted);">Sem vídeo</div>';
                    
                    let authHtml = '';
                    if (c.idade < 18 && c.autorizacao_url) {
                        authHtml = `
                            <div style="margin-top: 5px; padding-top: 10px; border-top: 1px solid var(--card-border);">
                                <span style="display: block; font-size: 0.8rem; font-weight: bold; color: #10b981; margin-bottom: 5px;">Autorização Escrita (Menor de Idade):</span>
                                <a href="${c.autorizacao_url}" target="_blank" title="Clique para ampliar">
                                    <img src="${c.autorizacao_url}" alt="Autorização" style="width: 100%; border-radius: 4px; max-height: 120px; object-fit: cover; border: 1px solid #10b981;">
                                </a>
                            </div>
                        `;
                    }

                    videoCard.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                            <img src="${fotoUrl}" alt="Foto de ${c.nome}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                            <h4 style="margin: 0; color: var(--text-main); font-size: 1rem;">${c.nome}</h4>
                        </div>
                        ${videoHtml}

                        ${authHtml}
                    `;
                    videosGrid.appendChild(videoCard);
                }

                let aprovarBtnHtml = c.aprovada 
                    ? `<button class="btn-aprovar" style="background: #10b981; color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" data-id="${c.id}" data-action="desaprovar">Aprovada ✓</button>`
                    : `<button class="btn-aprovar" style="background: var(--primary); color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" data-id="${c.id}" data-action="aprovar">Aprovar</button>`;

                let trocarFotosHtml = `
                    <label class="btn-trocar-foto" style="display:inline-block; margin-top:5px; background:var(--card-bg); color:var(--text-main); border: 1px solid var(--card-border); padding: 5px 10px; border-radius:4px; font-size: 0.8rem; cursor:pointer; text-align:center;">
                        Trocar Foto(s)
                        <input type="file" class="input-trocar-foto" data-id="${c.id}" accept="image/*" style="display:none;" multiple>
                    </label>
                `;

                tr.innerHTML = `
                    <td>
                        <div class="candidata-col">
                            <a href="${fotoUrl}" target="_blank" title="Ver foto em tamanho real">
                                <img src="${fotoUrl}" alt="${c.nome}">
                            </a>
                            <strong>${c.nome}</strong>
                        </div>
                    </td>
                    <td style="color: var(--text-muted); font-size: 0.9rem;">${c.cpf || '-'}</td>
                    <td style="font-weight: bold; color: ${c.idade < 18 ? 'var(--primary)' : 'inherit'};">${c.idade}</td>
                    <td><a href="https://wa.me/55${c.contato.replace(/\D/g, '')}" target="_blank" style="color: var(--text-main); text-decoration: none;">${c.contato}</a></td>
                    <td>${c.localidade}</td>
                    <td>${parentescoStatus}</td>
                    <td>${authStatus}</td>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            ${aprovarBtnHtml}
                            ${trocarFotosHtml}
                        </div>
                    </td>
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

    // Event listener for Aprovação
    document.getElementById('inscricoesBody').addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-aprovar')) {
            const btn = e.target;
            const id = btn.getAttribute('data-id');
            const action = btn.getAttribute('data-action');
            const isAprovando = action === 'aprovar';
            
            btn.disabled = true;
            btn.textContent = 'Processando...';
            
            try {
                const { data, error } = await supabaseClient
                    .from('candidatas')
                    .update({ aprovada: isAprovando })
                    .eq('id', id)
                    .select();
                    
                if (error) throw error;
                if (!data || data.length === 0) {
                    throw new Error("Permissão negada (RLS). Você precisa adicionar a política de UPDATE no Supabase.");
                }
                
                if (isAprovando) {
                    btn.style.background = '#10b981';
                    btn.textContent = 'Aprovada ✓';
                    btn.setAttribute('data-action', 'desaprovar');
                } else {
                    btn.style.background = 'var(--primary)';
                    btn.textContent = 'Aprovar';
                    btn.setAttribute('data-action', 'aprovar');
                }
            } catch (err) {
                console.error('Erro ao atualizar status:', err);
                alert('Erro ao atualizar: ' + (err.message || 'Verifique se a coluna "aprovada" existe e se há política de UPDATE.'));
                btn.textContent = isAprovando ? 'Aprovar' : 'Aprovada ✓';
            } finally {
                btn.disabled = false;
            }
        }
    });

    // Event listener for Trocar Foto
    document.getElementById('inscricoesBody').addEventListener('change', async (e) => {
        if (e.target.classList.contains('input-trocar-foto')) {
            const input = e.target;
            const id = input.getAttribute('data-id');
            const files = input.files;
            
            if (!files || files.length === 0) return;

            const label = input.parentElement;
            const originalLabelHtml = label.innerHTML;
            label.innerHTML = 'Enviando...';
            label.style.pointerEvents = 'none';

            try {
                let fotosUrls = [];
                for (let i = 0; i < files.length; i++) {
                    const fotoFile = files[i];
                    const fileExt = fotoFile.name.split('.').pop();
                    const fileName = `${Date.now()}_foto_prof_${i}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                    
                    const { data, error } = await supabaseClient.storage
                        .from('garota_regata_media')
                        .upload(`fotos/${fileName}`, fotoFile, {
                            contentType: fotoFile.type
                        });

                    if (error) throw error;
                    
                    const { data: publicUrlData } = supabaseClient.storage
                        .from('garota_regata_media')
                        .getPublicUrl(`fotos/${fileName}`);
                    
                    fotosUrls.push(publicUrlData.publicUrl);
                }

                // Update no banco
                const { error: updateError } = await supabaseClient
                    .from('candidatas')
                    .update({ fotos_urls: fotosUrls })
                    .eq('id', id);

                if (updateError) throw updateError;

                alert('Fotos atualizadas com sucesso!');
                loadResults(); // Recarrega para mostrar as novas fotos
            } catch (err) {
                console.error('Erro ao trocar fotos:', err);
                alert('Erro ao trocar fotos. Verifique as permissões de Storage e Update (RLS) no Supabase.');
                label.innerHTML = originalLabelHtml;
                label.style.pointerEvents = 'auto';
            }
        }
    });


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
