const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// A data de encerramento agora é buscada diretamente no banco de dados
// através do Painel Administrativo.

document.addEventListener('DOMContentLoaded', async () => {
    const candidatesGrid = document.getElementById('candidatesGrid');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    // Modal elements
    const voteModal = document.getElementById('voteModal');
    const modalCandidateName = document.getElementById('modalCandidateName');
    const cancelVoteBtn = document.getElementById('cancelVoteBtn');
    const confirmVoteBtn = document.getElementById('confirmVoteBtn');
    
    const resultModal = document.getElementById('resultModal');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const closeResultBtn = document.getElementById('closeResultBtn');

    let deviceId = null;

    // ==========================================
    // 🔒 SUPER TRAVA DE NAVEGADOR
    // ==========================================
    const DB_NAME = 'RegataVotosDB_v3';
    const STORE_NAME = 'votos_v3';

    function initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async function getDeviceId() {
        let id = localStorage.getItem('device_id_v3');
        if (id) return id;

        const match = document.cookie.match(new RegExp('(^| )device_id_v3=([^;]+)'));
        if (match) return match[2];

        try {
            const db = await initIndexedDB();
            id = await new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get('device_id');
                req.onsuccess = () => resolve(req.result ? req.result.value : null);
                req.onerror = () => resolve(null);
            });
            if (id) return id;
        } catch(e) {}

        return generateUUID();
    }

    async function saveDeviceId(id) {
        localStorage.setItem('device_id_v3', id);
        const d = new Date();
        d.setTime(d.getTime() + (10*365*24*60*60*1000));
        document.cookie = "device_id_v3=" + id + ";expires=" + d.toUTCString() + ";path=/";
        try {
            const db = await initIndexedDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ id: 'device_id', value: id });
        } catch(e) {}
    }

    deviceId = await getDeviceId();
    await saveDeviceId(deviceId);

    async function setSuperCookieVoto() {
        // 1. LocalStorage
        localStorage.setItem('voted_garota_regata_v3', 'true');
        
        // 2. Cookie (10 anos)
        const d = new Date();
        d.setTime(d.getTime() + (10*365*24*60*60*1000));
        document.cookie = "voted_garota_regata_v3=true;expires=" + d.toUTCString() + ";path=/";

        // 3. IndexedDB
        try {
            const db = await initIndexedDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ id: 'voto_status', voted: true });
        } catch(e) {
            console.error('Erro IndexedDB', e);
        }
    }

    async function checkSuperCookieVoto() {
        // 1. LocalStorage V3 e V2
        if (localStorage.getItem('voted_garota_regata_v3') === 'true') return true;
        if (localStorage.getItem('voted_garota_regata_v2') === 'true') return true;
        
        // 2. Cookie V3 e V2
        if (document.cookie.indexOf('voted_garota_regata_v3=true') !== -1) return true;
        if (document.cookie.indexOf('voted_garota_regata_v2=true') !== -1) return true;

        // 3. IndexedDB V3
        try {
            const db = await initIndexedDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get('voto_status');
                req.onsuccess = () => {
                    if (req.result && req.result.voted) resolve(true);
                    else resolve(false);
                };
                req.onerror = () => resolve(false);
            });
        } catch(e) {
            return false;
        }
    }

    // ==========================================
    // 🔍 CONSULTA AO BANCO PARA REVALIDAR TRAVA
    // ==========================================
    if (deviceId) {
        try {
            const { data: voteData } = await supabaseClient
                .from('votos')
                .select('id')
                .eq('device_fingerprint', deviceId)
                .maybeSingle();
            
            // Se encontrou no banco, significa que ele votou. Reativamos a trava V3!
            if (voteData) {
                setSuperCookieVoto();
            }
        } catch(e) {
            console.error("Erro ao verificar histórico no banco", e);
        }
    }

    // Verificar se votação já encerrou buscando do banco
    let dataFim = null;
    try {
        const { data, error } = await supabaseClient
            .from('configuracoes')
            .select('valor')
            .eq('chave', 'data_encerramento')
            .maybeSingle();
        
        if (data && data.valor) {
            // Adiciona o fuso horário de Brasília (UTC-3) para garantir que funcione
            // independente do fuso horário do aparelho de quem está votando
            dataFim = new Date(data.valor + ':00-03:00');
        }
    } catch (e) {
        console.error('Erro ao buscar data de encerramento:', e);
    }

    const dataAtual = new Date();
    
    // Se a data do banco existir e o tempo atual já tiver passado, encerra
    if (dataFim && dataAtual > dataFim) {
        loadingMessage.classList.add('hidden');
        errorMessage.innerHTML = '<h2>Votação Encerrada!</h2><p style="font-weight: 400; margin-top: 10px;">Agradecemos a participação de todos. Os resultados serão divulgados em breve.</p>';
        errorMessage.style.color = 'var(--text-main)';
        errorMessage.classList.remove('hidden');
        return; // Impede o carregamento das candidatas
    }

    // Carregar candidatas
    async function loadCandidates() {
        try {
            const { data, error } = await supabaseClient
                .from('candidatas_publicas')
                .select('id, nome, localidade, idade, fotos_urls')
                .order('nome', { ascending: true });

            if (error) throw error;

            loadingMessage.classList.add('hidden');
            
            if (data && data.length > 0) {
                renderCandidates(data);
                candidatesGrid.classList.remove('hidden');
                errorMessage.classList.add('hidden'); // Ocultar erro se houver candidatas
            } else {
                errorMessage.textContent = 'Nenhuma candidata cadastrada ainda.';
                errorMessage.classList.remove('hidden');
                candidatesGrid.classList.add('hidden'); // Ocultar grid se não houver candidatas
            }

        } catch (error) {
            console.error('Erro ao carregar candidatas:', error);
            loadingMessage.classList.add('hidden');
            errorMessage.classList.remove('hidden');
        }
    }

    function renderCandidates(candidates) {
        candidatesGrid.innerHTML = '';
        candidates.forEach(c => {
            const card = document.createElement('div');
            card.className = 'candidate-card';
            
            let fotoUrl = (c.fotos_urls && c.fotos_urls.length > 0) ? c.fotos_urls[0] : 'https://via.placeholder.com/300x400?text=Sem+Foto';
            
            // Otimização Extrema: Usar proxy CDN global para comprimir (WebP), reduzir a qualidade (80) e redimensionar largura (400px)
            if (fotoUrl.startsWith('http') && !fotoUrl.includes('placeholder')) {
                fotoUrl = `https://wsrv.nl/?url=${encodeURIComponent(fotoUrl)}&w=400&q=80&output=webp`;
            }

            card.innerHTML = `
                <div class="candidate-photo-wrapper">
                    <img src="${fotoUrl}" alt="Foto de ${c.nome}" class="candidate-photo" loading="lazy" onerror="this.src='https://via.placeholder.com/300x400?text=Erro+na+Foto'">
                </div>
                <div class="candidate-info">
                    <h3>${c.nome}</h3>
                    <p class="candidate-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg> 
                        ${c.localidade}
                    </p>
                    <p class="candidate-age">${c.idade} anos</p>
                    <button class="vote-btn" data-id="${c.id}" data-name="${c.nome}">Votar</button>
                </div>
            `;
            candidatesGrid.appendChild(card);
        });

        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                selectedCandidateId = e.target.getAttribute('data-id');
                const candidateName = e.target.getAttribute('data-name');
                openVoteModal(candidateName);
            });
        });
    }

    function openVoteModal(name) {
        modalCandidateName.textContent = name;
        voteModal.classList.remove('hidden');
    }

    function closeVoteModal() {
        voteModal.classList.add('hidden');
        selectedCandidateId = null;
    }

    function showResult(title, message, isError = false) {
        resultTitle.textContent = title;
        resultTitle.style.color = isError ? 'var(--error)' : '#10b981';
        resultMessage.textContent = message;
        resultModal.classList.remove('hidden');
    }

    cancelVoteBtn.addEventListener('click', closeVoteModal);

    closeResultBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
    });

    confirmVoteBtn.addEventListener('click', async () => {
        if (!selectedCandidateId || !deviceId) return;

        confirmVoteBtn.textContent = 'Processando...';
        confirmVoteBtn.disabled = true;

        const hasVoted = await checkSuperCookieVoto();
        if (hasVoted) {
            closeVoteModal();
            showResult('Voto Negado', 'Você já registrou um voto neste dispositivo.', true);
            resetConfirmBtn();
            // Re-aplicar a trava por precaução caso ele tenha tentado limpar parte dela
            setSuperCookieVoto();
            return;
        }

        // Verificação extra na hora exata do clique (caso a pessoa deixe a aba aberta)
        if (dataFim && new Date() > dataFim) {
            closeVoteModal();
            showResult('Votação Encerrada', 'O tempo limite de votação acabou!', true);
            resetConfirmBtn();
            // Recarrega a página para sumir a lista
            setTimeout(() => window.location.reload(), 2000);
            return;
        }

        try {
            // Chamando a RPC Segura
            const { data, error } = await supabaseClient.rpc('registrar_voto', {
                c_id: selectedCandidateId,
                fingerprint: deviceId
            });

            if (error) {
                throw error;
            }

            // Aplicar a super trava
            await setSuperCookieVoto();
            
            closeVoteModal();
            showResult('Voto Computado!', 'Seu voto foi registrado com sucesso. Obrigado por participar!', false);

        } catch (error) {
            console.error("Erro ao votar:", error);
            closeVoteModal();
            
            if (error.message && error.message.includes('Voto duplicado') || error.code === '23505') {
                 showResult('Voto Negado', 'Já existe um voto registrado para este dispositivo no nosso sistema.', true);
                 setSuperCookieVoto();
            } else {
                 showResult('Erro', 'Ocorreu um erro ao registrar seu voto. Verifique a conexão e tente novamente.', true);
            }
        } finally {
            resetConfirmBtn();
        }
    });

    function resetConfirmBtn() {
        confirmVoteBtn.textContent = 'Confirmar Voto';
        confirmVoteBtn.disabled = false;
    }

    // Configurar atualização em tempo real (Realtime do Supabase)
    supabaseClient
        .channel('candidatas_realtime')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'candidatas' }, (payload) => {
            console.log('Status da candidata alterado!', payload);
            // Recarrega a lista para adicionar ou remover candidatas baseadas na aprovação
            loadCandidates();
        })
        .subscribe();

    loadCandidates();
});
