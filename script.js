    <!-- Script untuk Login Sederhana -->
    <script>
        const CORRECT_PASSWORD = "12345"; // Password sederhana

        function checkSession() {
            if (sessionStorage.getItem('isLoggedIn') === 'true') {
                showMainApp();
            }
        }

        function handleLogin(event) {
            event.preventDefault();
            const password = document.getElementById('passwordInput').value;
            const errorMsg = document.getElementById('loginError');

            if (password === CORRECT_PASSWORD) {
                sessionStorage.setItem('isLoggedIn', 'true');
                showMainApp();
                errorMsg.classList.add('hidden');
            } else {
                errorMsg.classList.remove('hidden');
                const form = document.getElementById('loginForm');
                form.classList.add('animate-pulse');
                setTimeout(() => form.classList.remove('animate-pulse'), 500);
            }
        }

        function handleLogout() {
            sessionStorage.removeItem('isLoggedIn');
            location.reload(); // Reload halaman untuk kembali ke login
        }

        function showMainApp() {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
        }

        // Cek sesi saat halaman dimuat
        checkSession();
    </script>

    <script type="module">
		import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
        import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
		import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
        // --- Konfigurasi & Inisialisasi ---
        
        // CATATAN DEPLOY: Jika Anda menghosting file ini di luar, isi variabel ini:
        const MANUAL_CONFIG = {
			apiKey: "AIzaSyBTjZYeHMhTxIbxUMcIG-UebYCvrSCWdRs",
			authDomain: "rt234-loan-tracker.firebaseapp.com",
			projectId: "rt234-loan-tracker",
			storageBucket: "rt234-loan-tracker.firebasestorage.app",
			messagingSenderId: "1013156185202",
			appId: "1:1013156185202:web:dd8daa3cd74448e77faeeb",
			measurementId: "G-3D5F7J1EF3"
        };

        // Menggunakan config dari environment (jika ada) atau manual (jika di-deploy sendiri)
        const firebaseConfig = (typeof __firebase_config !== 'undefined' && __firebase_config) 
            ? JSON.parse(__firebase_config) 
            : MANUAL_CONFIG;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'loan-tracker-app';
        
        // Peringatan jika config kosong saat dijalankan secara lokal
        if (Object.keys(firebaseConfig).length === 0) {
            console.warn("Konfigurasi Firebase belum diset. Silakan edit bagian MANUAL_CONFIG di dalam kode.");
            alert("Mode Demo Terbatas: Database tidak terhubung. Silakan edit file dan isi 'MANUAL_CONFIG' dengan kredensial Firebase Anda agar data tersimpan.");
        }

        let app, auth, db;
        let userId = null;

        // Inisialisasi Aman
        try {
            if (Object.keys(firebaseConfig).length > 0) {
                app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                db = getFirestore(app);
                initAuth();
            }
        } catch (e) {
            console.error("Gagal menginisialisasi Firebase:", e);
        }

        // --- Setup Auth ---
        async function initAuth() {
            if (!auth) return;
            try {
                const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                if (token) {
                    await signInWithCustomToken(auth, token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (err) {
                console.error("Auth error:", err);
            }
        }

        if (auth) {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    userId = user.uid;
                    setupRealtimeListener();
                }
            });
        }

        // --- Helper: Format Rupiah ---
        const formatRupiah = (number) => {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(number);
        };

        // --- Logic Firestore ---
        
        window.addLoan = async () => {
            // Cek DB connection
            if (!db || !userId) {
                alert("Database belum terhubung. Pastikan Anda sudah mengisi konfigurasi Firebase.");
                return;
            }
            
            const borrower = document.getElementById('inputBorrower').value.trim();
            const source = document.getElementById('inputSource').value; // Mengambil value dari Select
            const total = parseFloat(document.getElementById('inputTotal').value);
            const installment = parseFloat(document.getElementById('inputInstallment').value);

            if (!borrower || !source || isNaN(total) || isNaN(installment) || total <= 0) {
                alert("Mohon lengkapi semua data dengan benar (termasuk Nama dan RT).");
                return;
            }

            try {
                await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'loans'), {
                    borrowerName: borrower, 
                    source: source,
                    totalAmount: total,
                    installmentAmount: installment,
                    paidPeriods: 0,
                    createdAt: Date.now()
                });
                
                // Reset Form
                document.getElementById('inputBorrower').value = '';
                document.getElementById('inputSource').value = '';
                document.getElementById('inputTotal').value = '';
                document.getElementById('inputInstallment').value = '';
            } catch (err) {
                console.error("Error adding loan:", err);
                alert("Gagal menambah data.");
            }
        };

        window.updatePeriod = async (id, currentPeriods, change, maxPeriods) => {
            if (!db || !userId) return;
            
            const newPeriod = currentPeriods + change;
            if (newPeriod < 0) return;
            if (newPeriod > maxPeriods) return;

            try {
                await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'loans', id), {
                    paidPeriods: newPeriod
                });
            } catch (err) {
                console.error("Error updating period:", err);
            }
        };

        window.deleteLoan = async (id) => {
            if (!db || !userId || !confirm("Yakin ingin menghapus data ini?")) return;
            
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'loans', id));
            } catch (err) {
                console.error("Error deleting:", err);
            }
        };

        // --- Realtime Listener & UI ---
        function setupRealtimeListener() {
            if (!db || !userId) return;

            const q = query(collection(db, 'artifacts', appId, 'users', userId, 'loans'), orderBy('createdAt', 'desc'));
            
            onSnapshot(q, (snapshot) => {
                const loanListEl = document.getElementById('loanList');
                loanListEl.innerHTML = '';
                
                let grandTotalLoan = 0;
                let grandTotalPaid = 0;
                let grandTotalRemaining = 0;
                let hasData = false;

                snapshot.forEach(docSnap => {
                    hasData = true;
                    const data = docSnap.data();
                    const id = docSnap.id;

                    const paidAmount = data.paidPeriods * data.installmentAmount;
                    const remaining = data.totalAmount - paidAmount;
                    const progressPercent = Math.min((paidAmount / data.totalAmount) * 100, 100);
                    const totalPeriodsEstimate = Math.ceil(data.totalAmount / data.installmentAmount);
                    const displayName = data.borrowerName ? data.borrowerName : "Tanpa Nama";

                    grandTotalLoan += data.totalAmount;
                    grandTotalPaid += paidAmount;
                    grandTotalRemaining += Math.max(remaining, 0);

                    // Render Kartu
                    const card = document.createElement('div');
                    card.className = "bg-white p-5 rounded-xl card-shadow border border-gray-100 flex flex-col justify-between";
                    card.innerHTML = `
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h4 class="text-lg font-bold text-gray-800">${displayName}</h4>
                                        <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">${data.source}</span>
                                    </div>
                                    <p class="text-sm text-gray-500 mt-1">Cicilan: ${formatRupiah(data.installmentAmount)} / periode</p>
                                </div>
                                <button onclick="deleteLoan('${id}')" class="text-gray-400 hover:text-red-500 transition p-1 rounded-full hover:bg-red-50">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-2.5 mb-4 mt-2">
                                <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="grid grid-cols-2 gap-4 mb-4 text-sm bg-gray-50 p-3 rounded-lg">
                                <div>
                                    <p class="text-gray-500 text-xs uppercase tracking-wide">Total Pinjaman</p>
                                    <p class="font-bold text-gray-800">${formatRupiah(data.totalAmount)}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-gray-500 text-xs uppercase tracking-wide">Sisa Hutang</p>
                                    <p class="font-bold ${remaining <= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                                        ${remaining <= 0 ? 'Lunas!' : formatRupiah(remaining)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between pt-3 border-t border-gray-100">
                            <div class="text-xs font-medium text-gray-600">
                                SUDAH BAYAR: <span class="text-blue-600 text-lg font-bold ml-1">${data.paidPeriods}</span> <span class="text-gray-400 mx-1">/</span> ${totalPeriodsEstimate}
                            </div>
                            <div class="flex items-center space-x-2">
                                <button onclick="updatePeriod('${id}', ${data.paidPeriods}, -1, ${totalPeriodsEstimate})" 
                                    class="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 transition"
                                    ${data.paidPeriods <= 0 ? 'disabled' : ''}>
                                    -
                                </button>
                                <button onclick="updatePeriod('${id}', ${data.paidPeriods}, 1, ${totalPeriodsEstimate})" 
                                    class="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-50 transition"
                                    ${remaining <= 0 ? 'disabled' : ''}>
                                    +
                                </button>
                            </div>
                        </div>
                    `;
                    loanListEl.appendChild(card);
                });

                if (!hasData) {
                    loanListEl.innerHTML = `<div class="col-span-1 md:col-span-2 text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">Belum ada data. Silakan tambah data baru di atas.</div>`;
                }

                // Update Ringkasan Dashboard
                document.getElementById('summaryTotalLoan').textContent = formatRupiah(grandTotalLoan);
                document.getElementById('summaryTotalPaid').textContent = formatRupiah(grandTotalPaid);
                document.getElementById('summaryRemaining').textContent = formatRupiah(grandTotalRemaining);
            });
        }
    </script>
