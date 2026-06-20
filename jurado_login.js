const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('juradoLoginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    // Se já estiver logado, redireciona
    if (localStorage.getItem('jurado_session')) {
        window.location.href = 'jurado_dashboard.html';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const loginInput = document.getElementById('login').value.trim();
        const senhaInput = document.getElementById('senha').value.trim();

        if (!loginInput || !senhaInput) return;

        loginBtn.textContent = 'Verificando...';
        loginBtn.disabled = true;
        loginError.classList.add('hidden');

        try {
            // Check credentials securely via RPC
            const { data, error } = await supabaseClient.rpc('login_jurado_seguro', {
                nome_jurado: loginInput,
                senha_jurado: senhaInput
            });

            if (error || !data || !data.success) {
                loginError.textContent = 'Nome ou senha incorretos.';
                loginError.classList.remove('hidden');
            } else {
                // Save session in localStorage
                const sessionData = {
                    id: data.id,
                    nome: data.nome
                };
                localStorage.setItem('jurado_session', JSON.stringify(sessionData));
                
                // Redirect to dashboard
                window.location.href = 'jurado_dashboard.html';
            }

        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'Erro ao conectar. Tente novamente.';
            loginError.classList.remove('hidden');
        } finally {
            loginBtn.textContent = 'Entrar no Painel';
            loginBtn.disabled = false;
        }
    });
});
