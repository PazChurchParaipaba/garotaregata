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
    
    // Login Elements
    const adminLoginOverlay = document.getElementById('adminLoginOverlay');
    const adminContent = document.getElementById('adminContent');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminLoginError = document.getElementById('adminLoginError');

    let adminPass = localStorage.getItem('admin_senha') || '';

    // Verifica Login
    async function checkLogin(senha) {
        try {
            const { data, error } = await supabaseClient.rpc('verificar_senha_admin', { senha_tentativa: senha });
            if (error) throw error;
            return data; // returns boolean
        } catch(e) {
            console.error('Erro ao verificar senha:', e);
            return false;
        }
    }

    async function initAdmin() {
        if (adminPass) {
            const isLogado = await checkLogin(adminPass);
            if (isLogado) {
                adminLoginOverlay.style.display = 'none';
                adminContent.style.display = 'block';
                loadConfig();
                loadResults();
            } else {
                localStorage.removeItem('admin_senha');
                adminPass = '';
            }
        }
    }

    adminLoginBtn.addEventListener('click', async () => {
        const pass = adminPasswordInput.value;
        adminLoginBtn.textContent = 'Verificando...';
        adminLoginBtn.disabled = true;
        adminLoginError.style.display = 'none';

        const isLogado = await checkLogin(pass);
        if (isLogado) {
            adminPass = pass;
            localStorage.setItem('admin_senha', pass);
            adminLoginOverlay.style.display = 'none';
            adminContent.style.display = 'block';
            loadConfig();
            loadResults();
        } else {
            adminLoginError.style.display = 'block';
        }
        
        adminLoginBtn.textContent = 'Entrar no Painel';
        adminLoginBtn.disabled = false;
    });

    // Inicializa
    initAdmin();

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

    async function loadResults(isBackgroundUpdate = false) {
        if (!isBackgroundUpdate) {
            loadingPanel.classList.remove('hidden');
            leaderboardTable.classList.add('hidden');
            // Ocultar as outras tabelas durante o carregamento inicial completo
            const iTable = document.getElementById('inscricoesTable');
            const nTable = document.getElementById('notasJuradosTable');
            if (iTable) iTable.classList.add('hidden');
            if (nTable) nTable.classList.add('hidden');
        }
        
        refreshBtn.disabled = true;
        if (!isBackgroundUpdate) {
            refreshBtn.textContent = 'Atualizando...';
        }

        try {
            // Buscar todas as candidatas (com dados completos)
            const { data: candidatas, error: candidatasError } = await supabaseClient
                .from('candidatas')
                .select('id, nome, cpf, localidade, fotos_urls, idade, contato, autorizacao_url, video_url, mora_paraipaba, aprovada, penalidade_pontos, penalidade_motivo');

            if (candidatasError) throw candidatasError;

            // Buscar todos os votos com paginação (para contornar o limite de 1000 do Supabase)
            let votos = [];
            let hasMore = true;
            let rangeStart = 0;
            const limit = 1000;

            while (hasMore) {
                const { data: batch, error: votosError } = await supabaseClient
                    .from('votos')
                    .select('candidata_id')
                    .range(rangeStart, rangeStart + limit - 1);

                if (votosError) throw votosError;

                votos = votos.concat(batch);

                if (batch.length < limit) {
                    hasMore = false;
                } else {
                    rangeStart += limit;
                }
            }

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
            const notasJuradosBody = document.getElementById('notasJuradosBody');
            const notasJuradosTable = document.getElementById('notasJuradosTable');
            
            inscricoesBody.innerHTML = '';
            videosGrid.innerHTML = '';
            notasJuradosBody.innerHTML = '';

            // Buscar notas dos jurados
            const { data: notasBanho } = await supabaseClient.from('notas_traje_banho').select('*');
            const { data: notasTipico } = await supabaseClient.from('notas_traje_tipico').select('*');

            // Calcular pontuação de cada candidata baseada nos jurados
            const candidatasNotas = candidatas.map(c => {
                const cBanho = (notasBanho || []).filter(n => n.candidata_id === c.id);
                const cTipico = (notasTipico || []).filter(n => n.candidata_id === c.id);

                let banhoTotal = 0;
                cBanho.forEach(n => {
                    banhoTotal += (n.desenvoltura || 0) + (n.postura || 0) + (n.passarela || 0) + (n.elegancia || 0) + (n.simpatia || 0) + (n.beleza || 0);
                });

                let tipicoTotal = 0;
                cTipico.forEach(n => {
                    tipicoTotal += (n.criatividade_originalidade || 0) + (n.fidelidade_tema || 0) + (n.representatividade_cultural || 0) + (n.postura || 0) + (n.apresentacao_candidata || 0);
                });

                const penalidade = c.penalidade_pontos || 0;
                const totalGeral = banhoTotal + tipicoTotal + penalidade;

                return {
                    ...c,
                    banhoTotal,
                    tipicoTotal,
                    penalidade,
                    totalGeral
                };
            });

            // Ordenar ranking dos jurados
            candidatasNotas.sort((a, b) => b.totalGeral - a.totalGeral);

            candidatasNotas.forEach((c, index) => {
                const tr = document.createElement('tr');
                const fotoUrl = (c.fotos_urls && c.fotos_urls.length > 0) ? c.fotos_urls[0] : 'https://via.placeholder.com/40';
                let medal = '';
                if (index === 0) medal = '👑 ';
                if (index === 1) medal = '🥈 ';
                if (index === 2) medal = '🥉 ';

                tr.innerHTML = `
                    <td class="posicao-col">${medal}${index + 1}º</td>
                    <td>
                        <div class="candidata-col">
                            <img src="${fotoUrl}" alt="${c.nome}">
                            <strong>${c.nome}</strong>
                        </div>
                    </td>
                    <td style="font-weight: 600;">${c.banhoTotal} pts</td>
                    <td style="font-weight: 600;">${c.tipicoTotal} pts</td>
                    <td style="color: var(--error); font-weight: bold;">${c.penalidade < 0 ? c.penalidade : 0}</td>
                    <td style="font-weight: 800; font-size: 1.2rem; color: var(--primary);">${c.totalGeral}</td>
                `;
                notasJuradosBody.appendChild(tr);
            });

            // Ordenar por nome para tabela de inscrições
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

                let penalidadeBtnHtml = `
                    <button class="btn-penalidade" style="background: var(--error); color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 5px;" data-id="${c.id}" data-nome="${c.nome}">
                        Penalizar
                    </button>
                `;

                let fotosHtml = '';
                if (c.fotos_urls && c.fotos_urls.length > 0) {
                    fotosHtml = `<div style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 5px;">` + 
                        c.fotos_urls.map(url => `
                            <a href="${url}" target="_blank" title="Ver foto">
                                <img src="${url}" alt="${c.nome}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid var(--card-border);">
                            </a>
                        `).join('') + `</div>`;
                } else {
                    fotosHtml = `<img src="https://via.placeholder.com/40" alt="Sem foto">`;
                }

                tr.innerHTML = `
                    <td>
                        <div class="candidata-col" style="align-items: flex-start; flex-direction: column;">
                            ${fotosHtml}
                            <strong>${c.nome}</strong>
                        </div>
                    </td>
                    <td style="color: var(--text-muted); font-size: 0.9rem;">${c.cpf || '-'}</td>
                    <td style="font-weight: bold; color: ${c.idade < 18 ? 'var(--primary)' : 'inherit'};">${c.idade}</td>
                    <td><a href="https://wa.me/55${c.contato.replace(/\\D/g, '')}" target="_blank" style="color: var(--text-main); text-decoration: none;">${c.contato}</a></td>
                    <td>${c.localidade}</td>
                    <td>${parentescoStatus}</td>
                    <td>${authStatus}</td>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            ${aprovarBtnHtml}
                            ${trocarFotosHtml}
                            ${penalidadeBtnHtml}
                        </div>
                    </td>
                `;
                inscricoesBody.appendChild(tr);                inscricoesBody.appendChild(tr);
            });

            if (!isBackgroundUpdate) {
                loadingPanel.classList.add('hidden');
                leaderboardTable.classList.remove('hidden');
                inscricoesTable.classList.remove('hidden');
                notasJuradosTable.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Erro ao carregar resultados:', error);
            alert('Erro ao carregar os dados. Verifique a conexão com o banco de dados. Você já criou a tabela votos?');
        } finally {
            refreshBtn.disabled = false;
            if (!isBackgroundUpdate) {
                refreshBtn.textContent = 'Atualizar Resultados';
            }
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
                const { data, error } = await supabaseClient.rpc('admin_aprovar_candidata', {
                    c_id: id,
                    is_aprovada: isAprovando,
                    senha: adminPass
                });
                    
                if (error) throw error;
                
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
                alert('Erro ao atualizar: ' + (err.message || 'Verifique a senha ou permissão.'));
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

                // Update no banco via RPC
                const { error: updateError } = await supabaseClient.rpc('admin_atualizar_fotos', {
                    c_id: id,
                    novas_fotos: fotosUrls,
                    senha: adminPass
                });

                if (updateError) throw updateError;

                alert('Fotos atualizadas com sucesso!');
                loadResults(); // Recarrega para mostrar as novas fotos
            } catch (err) {
                console.error('Erro ao trocar fotos:', err);
                alert('Erro: ' + (err.message || JSON.stringify(err)));
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
            
            loadResults(true).then(() => {
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

    // Event listener for Penalidade
    let currentPenaltyId = null;
    const penaltyModal = document.getElementById('penaltyModal');
    const penaltyCandidateName = document.getElementById('penaltyCandidateName');
    const penaltyReason = document.getElementById('penaltyReason');
    const penaltyPoints = document.getElementById('penaltyPoints');
    const savePenaltyBtn = document.getElementById('savePenaltyBtn');
    const cancelPenaltyBtn = document.getElementById('cancelPenaltyBtn');

    document.getElementById('inscricoesBody').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-penalidade')) {
            const btn = e.target;
            currentPenaltyId = btn.getAttribute('data-id');
            penaltyCandidateName.textContent = btn.getAttribute('data-nome');
            penaltyReason.value = '';
            penaltyPoints.value = '';
            penaltyModal.classList.remove('hidden');
        }
    });

    cancelPenaltyBtn.addEventListener('click', () => {
        penaltyModal.classList.add('hidden');
        currentPenaltyId = null;
    });

    savePenaltyBtn.addEventListener('click', async () => {
        if (!currentPenaltyId) return;
        const motivo = penaltyReason.value;
        const pontos = parseInt(penaltyPoints.value) || 0;

        if (pontos > 0) {
            alert("Penalidades devem ser números negativos ou zero (ex: -5)");
            return;
        }

        savePenaltyBtn.disabled = true;
        savePenaltyBtn.textContent = 'Salvando...';

        try {
            const { data, error } = await supabaseClient.rpc('admin_penalizar', {
                c_id: currentPenaltyId,
                pontos: pontos,
                motivo: motivo,
                senha: adminPass
            });

            if (error) throw error;
            
            alert('Penalidade aplicada com sucesso!');
            penaltyModal.classList.add('hidden');
            currentPenaltyId = null;
            loadResults();
        } catch (err) {
            console.error('Erro ao aplicar penalidade:', err);
            alert('Erro ao aplicar penalidade: ' + err.message);
        } finally {
            savePenaltyBtn.disabled = false;
            savePenaltyBtn.textContent = 'Salvar Penalidade';
        }
    });

    // === AUDITORIA ===
    const auditBtn = document.getElementById('auditBtn');
    const auditModal = document.getElementById('auditModal');
    const closeAuditBtn = document.getElementById('closeAuditBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    
    let auditPieChartInstance = null;
    let auditLineChartInstance = null;

    auditBtn.addEventListener('click', async () => {
        auditModal.classList.remove('hidden');
        await carregarDadosAuditoria();
    });

    closeAuditBtn.addEventListener('click', () => {
        auditModal.classList.add('hidden');
    });

    async function carregarDadosAuditoria() {
        const tbody = document.getElementById('auditTableBody');
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Carregando dados de auditoria...</td></tr>';
        
        try {
            // Pegar todas as candidatas para ter os nomes
            const { data: candidatasData, error: candError } = await supabaseClient
                .from('candidatas')
                .select('id, nome')
                .eq('is_aprovada', true);
                
            if (candError) throw candError;
            
            const candidatasMap = {};
            candidatasData.forEach(c => { candidatasMap[c.id] = c.nome; });

            // Pegar os votos
            const { data: votosData, error: votosError } = await supabaseClient
                .from('votos')
                .select('created_at, candidata_id, device_fingerprint')
                .order('created_at', { ascending: false });
                
            if (votosError) throw votosError;
            
            // Renderizar tabela com últimos 100
            tbody.innerHTML = '';
            const ultimosVotos = votosData.slice(0, 100);
            if (ultimosVotos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Nenhum voto registrado.</td></tr>';
            } else {
                ultimosVotos.forEach(v => {
                    const dataObj = new Date(v.created_at);
                    const dataStr = dataObj.toLocaleString('pt-BR');
                    const nome = candidatasMap[v.candidata_id] || 'Candidata Desconhecida';
                    const fp = v.device_fingerprint.substring(0, 10) + '...';
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${dataStr}</td>
                        <td>${nome}</td>
                        <td title="${v.device_fingerprint}">${fp}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // Agrupar dados para o gráfico de pizza (Total por candidata)
            const votosPorCandidata = {};
            candidatasData.forEach(c => { votosPorCandidata[c.nome] = 0; });
            
            // Agrupar dados para gráfico de linha (Votos por hora)
            const votosPorHora = {};

            votosData.forEach(v => {
                const nome = candidatasMap[v.candidata_id] || 'Desconhecida';
                if (votosPorCandidata[nome] !== undefined) {
                    votosPorCandidata[nome]++;
                } else {
                    votosPorCandidata[nome] = 1;
                }
                
                // Pegar apenas YYYY-MM-DD HH
                const dataObj = new Date(v.created_at);
                const horaStr = `${dataObj.toLocaleDateString('pt-BR')} ${dataObj.getHours()}:00`;
                if (!votosPorHora[horaStr]) {
                    votosPorHora[horaStr] = 0;
                }
                votosPorHora[horaStr]++;
            });

            // Preparar arrays para Pizza
            const pieLabels = Object.keys(votosPorCandidata);
            const pieData = Object.values(votosPorCandidata);

            // Preparar arrays para Linha
            // Ordenar as chaves (horários)
            const sortedHoras = Object.keys(votosPorHora).sort((a, b) => {
                const [dateA, timeA] = a.split(' ');
                const [diaA, mesA, anoA] = dateA.split('/');
                const [horaA] = timeA.split(':');
                const valA = new Date(anoA, mesA - 1, diaA, horaA);

                const [dateB, timeB] = b.split(' ');
                const [diaB, mesB, anoB] = dateB.split('/');
                const [horaB] = timeB.split(':');
                const valB = new Date(anoB, mesB - 1, diaB, horaB);
                
                return valA - valB;
            });
            const lineData = sortedHoras.map(h => votosPorHora[h]);

            renderizarGraficos(pieLabels, pieData, sortedHoras, lineData);
            
        } catch (err) {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Erro ao carregar auditoria: ${err.message}</td></tr>`;
        }
    }

    function renderizarGraficos(pieLabels, pieData, lineLabels, lineData) {
        const bgColors = [
            '#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
            '#06b6d4', '#d946ef', '#64748b', '#84cc16', '#14b8a6'
        ];

        const pieCtx = document.getElementById('auditPieChart').getContext('2d');
        if (auditPieChartInstance) auditPieChartInstance.destroy();
        auditPieChartInstance = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: pieLabels,
                datasets: [{
                    data: pieData,
                    backgroundColor: bgColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        const lineCtx = document.getElementById('auditLineChart').getContext('2d');
        if (auditLineChartInstance) auditLineChartInstance.destroy();
        auditLineChartInstance = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: lineLabels,
                datasets: [{
                    label: 'Volume de Votos por Hora',
                    data: lineData,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    exportPdfBtn.addEventListener('click', () => {
        const element = document.getElementById('auditPrintArea');
        const opt = {
            margin:       10,
            filename:     'auditoria_votacao_publica.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        const header = document.getElementById('auditHeader');
        document.getElementById('auditDate').textContent = 'Gerado em: ' + new Date().toLocaleString('pt-BR');
        header.style.display = 'block';

        html2pdf().set(opt).from(element).save().then(() => {
            header.style.display = 'none';
        });
    });

    // loadConfig() e loadResults() agora são chamados após o login.
});
