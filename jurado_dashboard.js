const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let juradoSession = null;
let currentCandidateId = null;
let currentEvaluationType = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const sessionStr = localStorage.getItem('jurado_session');
    if (!sessionStr) {
        window.location.href = 'jurado_login.html';
        return;
    }
    juradoSession = JSON.parse(sessionStr);

    document.getElementById('juradoNameDisplay').textContent = `Bem-vindo, ${juradoSession.nome}`;

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('jurado_session');
        window.location.href = 'jurado_login.html';
    });

    // Load Candidates
    await loadCandidates();

    // Modal Events
    document.getElementById('cancelEvaluateBtn').addEventListener('click', closeModal);
    document.getElementById('evaluationForm').addEventListener('submit', handleEvaluationSubmit);
});

async function loadCandidates() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const grid = document.getElementById('candidatesGrid');

    try {
        const { data: candidatas, error } = await supabaseClient
            .from('candidatas')
            .select('*')
            .eq('aprovada', true)
            .order('nome', { ascending: true });

        if (error) throw error;

        loadingMessage.classList.add('hidden');
        grid.classList.remove('hidden');

        if (candidatas.length === 0) {
            grid.innerHTML = '<p style="text-align:center; color:white; grid-column:1/-1;">Nenhuma candidata aprovada no momento.</p>';
            return;
        }

        grid.innerHTML = candidatas.map(c => `
            <div class="candidate-card">
                <div class="candidate-photo-wrapper">
                    <img src="${c.fotos_urls && c.fotos_urls.length > 0 ? c.fotos_urls[0] : 'logo.png'}" alt="${c.nome}" class="candidate-photo">
                </div>
                <div class="candidate-info">
                    <h3>${c.nome}</h3>
                    <p class="candidate-age">${c.idade} anos</p>
                    ${c.penalidade_pontos && c.penalidade_pontos !== 0 ? `<div style="color:var(--error); font-weight:bold; font-size: 0.85rem; margin-top:5px; background: rgba(239, 68, 68, 0.1); padding: 5px; border-radius: 4px;">⚠️ Penalidade Total: ${c.penalidade_pontos} pts<br><span style="font-weight:normal; font-size: 0.75rem; white-space: pre-line;">${c.penalidade_motivo}</span></div>` : ''}
                    <div style="display: flex; gap: 10px; margin-top: auto;">
                        <button class="vote-btn" style="flex:1; font-size: 0.85rem; padding: 10px;" onclick="openEvaluateModal('${c.id}', '${c.nome}', 'banho')">Traje Banho</button>
                        <button class="vote-btn" style="flex:1; font-size: 0.85rem; padding: 10px; background-color: var(--secondary); color: var(--text-main);" onclick="openEvaluateModal('${c.id}', '${c.nome}', 'tipico')">Traje Típico</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading candidates:', error);
        loadingMessage.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
}

async function openEvaluateModal(candidateId, candidateName, type) {
    currentCandidateId = candidateId;
    currentEvaluationType = type;
    document.getElementById('modalCandidateName').textContent = candidateName + (type === 'banho' ? ' - Traje de Banho' : ' - Traje Típico');
    
    // Clear form
    document.getElementById('evaluationForm').reset();

    // Show only the correct section
    if (type === 'banho') {
        document.getElementById('sectionBanho').classList.remove('hidden');
        document.getElementById('sectionTipico').classList.add('hidden');
        // Make sure only required fields for this type are validated
        document.querySelectorAll('#sectionBanho select').forEach(el => el.required = true);
        document.querySelectorAll('#sectionTipico select').forEach(el => el.required = false);
    } else {
        document.getElementById('sectionTipico').classList.remove('hidden');
        document.getElementById('sectionBanho').classList.add('hidden');
        // Make sure only required fields for this type are validated
        document.querySelectorAll('#sectionTipico select').forEach(el => el.required = true);
        document.querySelectorAll('#sectionBanho select').forEach(el => el.required = false);
    }
    
    document.getElementById('submitEvaluateBtn').textContent = 'Carregando notas...';
    document.getElementById('submitEvaluateBtn').disabled = true;

    document.getElementById('evaluateModal').classList.remove('hidden');

    try {
        let jaVotou = false;

        if (type === 'banho') {
            const { data: notaBanho } = await supabaseClient
                .from('notas_traje_banho')
                .select('*')
                .eq('jurado_id', juradoSession.id)
                .eq('candidata_id', candidateId)
                .maybeSingle();

            if (notaBanho) {
                jaVotou = true;
                document.getElementById('banho_desenvoltura').value = notaBanho.desenvoltura || '';
                document.getElementById('banho_postura').value = notaBanho.postura || '';
                document.getElementById('banho_passarela').value = notaBanho.passarela || '';
                document.getElementById('banho_elegancia').value = notaBanho.elegancia || '';
                document.getElementById('banho_simpatia').value = notaBanho.simpatia || '';
                document.getElementById('banho_beleza').value = notaBanho.beleza || '';
            }
        }

        if (type === 'tipico') {
            const { data: notaTipico } = await supabaseClient
                .from('notas_traje_tipico')
                .select('*')
                .eq('jurado_id', juradoSession.id)
                .eq('candidata_id', candidateId)
                .maybeSingle();

            if (notaTipico) {
                jaVotou = true;
                document.getElementById('tipico_criatividade').value = notaTipico.criatividade_originalidade || '';
                document.getElementById('tipico_fidelidade').value = notaTipico.fidelidade_tema || '';
                document.getElementById('tipico_representatividade').value = notaTipico.representatividade_cultural || '';
                document.getElementById('tipico_postura').value = notaTipico.postura || '';
                document.getElementById('tipico_apresentacao').value = notaTipico.apresentacao_candidata || '';
            }
        }

        if (jaVotou) {
            document.getElementById('submitEvaluateBtn').style.display = 'none';
            document.querySelectorAll('#evaluationForm select').forEach(s => s.disabled = true);
            
            const warningHtml = `<div id="alreadyVotedWarning" style="margin-top: 15px; color: var(--error); font-weight: bold;">Você já avaliou esta candidata. As notas não podem ser alteradas.</div>`;
            if (!document.getElementById('alreadyVotedWarning')) {
                document.getElementById('submitEvaluateBtn').parentElement.insertAdjacentHTML('beforebegin', warningHtml);
            }
        } else {
            document.getElementById('submitEvaluateBtn').style.display = 'inline-block';
            document.getElementById('submitEvaluateBtn').textContent = 'Salvar Notas';
            document.getElementById('submitEvaluateBtn').disabled = false;
            document.querySelectorAll('#evaluationForm select').forEach(s => s.disabled = false);
            const warning = document.getElementById('alreadyVotedWarning');
            if (warning) warning.remove();
        }

    } catch (err) {
        console.error('Error fetching existing notes:', err);
    }
}

function closeModal() {
    document.getElementById('evaluateModal').classList.add('hidden');
    currentCandidateId = null;
}

async function handleEvaluationSubmit(e) {
    e.preventDefault();

    if (!currentCandidateId) return;

    const btn = document.getElementById('submitEvaluateBtn');
    btn.textContent = 'Salvando...';
    btn.disabled = true;

    try {
        if (currentEvaluationType === 'banho') {
            const banhoValues = {
                jurado_id: juradoSession.id,
                candidata_id: currentCandidateId,
                desenvoltura: parseInt(document.getElementById('banho_desenvoltura').value),
                postura: parseInt(document.getElementById('banho_postura').value),
                passarela: parseInt(document.getElementById('banho_passarela').value),
                elegancia: parseInt(document.getElementById('banho_elegancia').value),
                simpatia: parseInt(document.getElementById('banho_simpatia').value),
                beleza: parseInt(document.getElementById('banho_beleza').value),
            };

            const { error: errBanho } = await supabaseClient
                .from('notas_traje_banho')
                .upsert(banhoValues, { onConflict: 'jurado_id,candidata_id' });
            
            if (errBanho) throw errBanho;
        } else if (currentEvaluationType === 'tipico') {
            const tipicoValues = {
                jurado_id: juradoSession.id,
                candidata_id: currentCandidateId,
                criatividade_originalidade: parseInt(document.getElementById('tipico_criatividade').value),
                fidelidade_tema: parseInt(document.getElementById('tipico_fidelidade').value),
                representatividade_cultural: parseInt(document.getElementById('tipico_representatividade').value),
                postura: parseInt(document.getElementById('tipico_postura').value),
                apresentacao_candidata: parseInt(document.getElementById('tipico_apresentacao').value),
            };

            const { error: errTipico } = await supabaseClient
                .from('notas_traje_tipico')
                .upsert(tipicoValues, { onConflict: 'jurado_id,candidata_id' });
            
            if (errTipico) throw errTipico;
        }

        alert('Notas salvas com sucesso!');
        closeModal();
    } catch (err) {
        console.error('Error saving notes:', err);
        alert('Erro ao salvar as notas. Tente novamente.');
    } finally {
        btn.textContent = 'Salvar Notas';
        btn.disabled = false;
    }
}
