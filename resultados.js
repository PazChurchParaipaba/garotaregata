const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
    const candidatesGrid = document.getElementById('candidatesGrid');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    try {
        // Busca candidatas aprovadas
        const { data: candidatas, error: candidatasError } = await supabaseClient
            .from('candidatas')
            .select('*')
            .eq('aprovada', true);

        if (candidatasError) throw candidatasError;

        // Busca todos os votos (paginado)
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

        // Contar votos
        const voteCounts = {};
        votos.forEach(v => {
            voteCounts[v.candidata_id] = (voteCounts[v.candidata_id] || 0) + 1;
        });

        // Adicionar votos às candidatas e ordenar
        const results = candidatas.map(c => {
            return {
                ...c,
                votos_recebidos: voteCounts[c.id] || 0
            };
        });

        results.sort((a, b) => b.votos_recebidos - a.votos_recebidos);

        // Renderizar candidatas
        candidatesGrid.innerHTML = '';
        
        if (results.length === 0) {
            candidatesGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Nenhuma candidata cadastrada no momento.</p>';
        } else {
            results.forEach((candidate, index) => {
                const card = document.createElement('div');
                card.className = 'candidate-card';
                
                // Tratar URL da imagem (se for local ou base64)
                let photoUrl = candidate.foto_url;
                if (!photoUrl || photoUrl === '') {
                    photoUrl = 'https://via.placeholder.com/300x400?text=Sem+Foto';
                }

                // Destaque para o primeiro lugar
                const crown = index === 0 ? '<div style="position: absolute; top: 10px; left: 10px; font-size: 30px; z-index: 10;" title="1º Lugar">👑</div>' : '';
                const positionHtml = `<div style="text-align: center; font-weight: bold; font-size: 1.2rem; color: #f59e0b; margin-top: 10px;">${index + 1}º Lugar</div>`;
                const votesHtml = `<div style="text-align: center; font-weight: 800; font-size: 1.8rem; color: #10b981; margin: 10px 0;">${candidate.votos_recebidos} Votos</div>`;

                card.innerHTML = `
                    <div style="position: relative;">
                        ${crown}
                        <img src="${photoUrl}" alt="${candidate.nome}">
                    </div>
                    <div class="candidate-info">
                        ${positionHtml}
                        <h3>${candidate.nome}</h3>
                        <p class="locality">${candidate.localidade}</p>
                        ${votesHtml}
                    </div>
                `;
                candidatesGrid.appendChild(card);
            });
        }

        loadingMessage.classList.add('hidden');
        candidatesGrid.classList.remove('hidden');

    } catch (err) {
        console.error('Erro ao carregar dados:', err);
        loadingMessage.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
});
