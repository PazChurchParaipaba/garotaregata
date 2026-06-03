const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    const idadeInput = document.getElementById('idade');
    const authGroup = document.getElementById('authGroup');
    const authInput = document.getElementById('autorizacao');
    const form = document.getElementById('registrationForm');
    const fotosInput = document.getElementById('fotos');
    const fotosInfo = document.getElementById('fotos-info');
    const authInfo = authGroup.querySelector('.file-info');

    const videoInput = document.getElementById('video_apresentacao');
    const videoInfo = document.getElementById('video-info');
    const moraParaipabaSelect = document.getElementById('mora_paraipaba');
    const alertaParentesco = document.getElementById('alertaParentesco');

    // Update text when files are selected
    fotosInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            if (e.target.files.length === 1) {
                fotosInfo.textContent = e.target.files[0].name;
            } else {
                fotosInfo.textContent = `${e.target.files.length} arquivos selecionados`;
            }
            fotosInfo.style.color = 'var(--text-main)';
        } else {
            fotosInfo.textContent = 'Faça o upload de uma ou mais fotos com boa qualidade.';
            fotosInfo.style.color = 'var(--primary)';
        }
    });

    authInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            authInfo.textContent = e.target.files[0].name;
            authInfo.style.color = 'var(--text-main)';
        } else {
            authInfo.textContent = 'Faça o upload do documento de autorização assinado.';
            authInfo.style.color = 'var(--primary)';
        }
    });

    videoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            videoInfo.textContent = e.target.files[0].name;
            videoInfo.style.color = 'var(--text-main)';
        } else {
            videoInfo.textContent = 'Faça o upload de um vídeo seu de no máximo 1 minuto se apresentando.';
            videoInfo.style.color = 'var(--primary)';
        }
    });

    moraParaipabaSelect.addEventListener('change', (e) => {
        if (e.target.value === 'nao') {
            alertaParentesco.classList.remove('hidden');
            alertaParentesco.classList.add('visible');
        } else {
            alertaParentesco.classList.remove('visible');
            setTimeout(() => {
                if (moraParaipabaSelect.value !== 'nao') {
                    alertaParentesco.classList.add('hidden');
                }
            }, 300);
        }
    });

    // Handle conditional field rendering based on age
    idadeInput.addEventListener('input', (e) => {
        const age = parseInt(e.target.value);
        
        if (age >= 0 && age < 18) {
            authGroup.classList.remove('hidden');
            authGroup.classList.add('visible');
            authInput.setAttribute('required', 'true');
        } else {
            authGroup.classList.remove('visible');
            // Wait for animation to finish before hiding
            setTimeout(() => {
                if (parseInt(idadeInput.value) >= 18 || !idadeInput.value) {
                    authGroup.classList.add('hidden');
                }
            }, 300);
            authInput.removeAttribute('required');
            authInput.value = ''; // clear the file input
            authInfo.textContent = 'Faça o upload do documento de autorização assinado.';
        }
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = form.querySelector('.submit-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Enviando...';
        btn.disabled = true;

        try {
            const formData = new FormData(form);
            const nome = formData.get('nome');
            const cpf = formData.get('cpf');
            const idade = formData.get('idade');
            const contato = formData.get('contato');
            const localidade = formData.get('localidade');

            const mora_paraipaba = formData.get('mora_paraipaba');
            const fotoFiles = formData.getAll('fotos');
            const authFile = formData.get('autorizacao');
            const videoFile = formData.get('video_apresentacao');

            let fotosUrls = [];
            let autorizacaoUrl = null;
            let videoUrl = null;

            // 1. Upload Multiple Fotos
            if (fotoFiles && fotoFiles.length > 0) {
                for (let i = 0; i < fotoFiles.length; i++) {
                    const fotoFile = fotoFiles[i];
                    if (fotoFile.size > 0) {
                        const fileExt = fotoFile.name.split('.').pop();
                        const fileName = `${Date.now()}_foto_${i}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                        
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
                }
            }

            // 2. Upload Autorização if underage
            if (authFile && authFile.size > 0) {
                const fileExt = authFile.name.split('.').pop();
                const fileName = `${Date.now()}_auth_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { data, error } = await supabaseClient.storage
                    .from('garota_regata_media')
                    .upload(`autorizacoes/${fileName}`, authFile, {
                        contentType: authFile.type
                    });

                if (error) throw error;
                
                const { data: publicUrlData } = supabaseClient.storage
                    .from('garota_regata_media')
                    .getPublicUrl(`autorizacoes/${fileName}`);
                
                autorizacaoUrl = publicUrlData.publicUrl;
            }

            // Upload Video
            if (videoFile && videoFile.size > 0) {
                if (videoFile.size > 250 * 1024 * 1024) { // 250MB
                    throw new Error("O vídeo excede o tamanho máximo permitido de 250MB.");
                }
                const fileExt = videoFile.name.split('.').pop();
                const fileName = `${Date.now()}_video_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { data, error } = await supabaseClient.storage
                    .from('garota_regata_media')
                    .upload(`videos/${fileName}`, videoFile, {
                        contentType: videoFile.type
                    });

                if (error) throw error;
                
                const { data: publicUrlData } = supabaseClient.storage
                    .from('garota_regata_media')
                    .getPublicUrl(`videos/${fileName}`);
                
                videoUrl = publicUrlData.publicUrl;
            }

            // 3. Insert Database Record
            const { error: insertError } = await supabaseClient
                .from('candidatas')
                .insert([
                    {
                        nome,
                        cpf,
                        idade: parseInt(idade),
                        contato,
                        localidade,

                        video_url: videoUrl,
                        mora_paraipaba: mora_paraipaba,
                        fotos_urls: fotosUrls,
                        autorizacao_url: autorizacaoUrl
                    }
                ]);

            if (insertError) throw insertError;

            // Success state
            btn.textContent = 'Cadastro Realizado!';
            btn.style.background = '#10b981'; // Green
            btn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
            
            setTimeout(() => {
                form.reset();
                fotosInfo.textContent = 'Faça o upload de uma ou mais fotos com boa qualidade.';
                fotosInfo.style.color = 'var(--primary)';
                authInfo.textContent = 'Faça o upload do documento de autorização assinado.';
                authInfo.style.color = 'var(--primary)';
                videoInfo.textContent = 'Faça o upload de um vídeo seu de no máximo 1 minuto se apresentando.';
                videoInfo.style.color = 'var(--primary)';
                
                btn.textContent = originalText;
                btn.style.background = '';
                btn.style.boxShadow = '';
                btn.disabled = false;
                
                authGroup.classList.remove('visible');
                authGroup.classList.add('hidden');
            }, 3000);

        } catch (error) {
            console.error('Error submitting form:', error);
            const errorMsg = error.message ? error.message : 'Erro desconhecido.';
            alert(`Erro ao realizar o cadastro: ${errorMsg}\nPor favor, tente novamente.`);
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    // Simple phone mask
    const contatoInput = document.getElementById('contato');
    if (contatoInput) {
        contatoInput.addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }

    // Simple CPF mask
    const cpfInput = document.getElementById('cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }
            e.target.value = value;
        });
    }
});
