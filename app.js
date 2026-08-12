import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  signOut,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc,
  deleteDoc, 
  doc, 
  query, 
  where, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration Setup
const firebaseConfig = {
  apiKey: "AIzaSyD1XKWX7STZXPBI8Xgp5GEFqjgO_QQvwYU",
  authDomain: "expen-tracker-app.firebaseapp.com",
  projectId: "expen-tracker-app",
  storageBucket: "expen-tracker-app.firebasestorage.app",
  messagingSenderId: "721154485589",
  appId: "1:721154485589:web:c196af25ef8d94aefe93dc",
  measurementId: "G-Z6B45V8W23"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Currency Symbols Dictionary
const currencySymbols = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£'
};

// State Variables
let currentUser = null;
let selectedType = 'expense';
let selectedCategory = 'Food';
let currentCurrency = 'NGN';
let editingTxId = null; // Stores current transaction ID if editing

// Screen Elements
const screens = {
  signup: document.getElementById('screen-signup'),
  login: document.getElementById('screen-login'),
  forgot: document.getElementById('screen-forgot'),
  home: document.getElementById('screen-home'),
  create: document.getElementById('screen-create'),
  profile: document.getElementById('screen-profile')
};

function navigateTo(screenName) {
  Object.keys(screens).forEach(key => {
    if (screens[key]) screens[key].classList.add('hidden');
  });
  if (screens[screenName]) screens[screenName].classList.remove('hidden');
}

// TOGGLE SHOW/HIDE PASSWORD
document.querySelectorAll('.toggle-password').forEach(icon => {
  icon.addEventListener('click', () => {
    const targetId = icon.getAttribute('data-target');
    const input = document.getElementById(targetId);

    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });
});

// SELECT CURRENCY CHANGE LOGIC
document.getElementById('currency-select').addEventListener('change', (e) => {
  currentCurrency = e.target.value;
  const symbol = currencySymbols[currentCurrency];
  document.getElementById('create-currency-symbol').innerText = symbol;
  loadTransactions();
});

// AUTHENTICATION STATE OBSERVER
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('display-username').innerText = user.displayName || 'User';
    await loadTransactions();
    navigateTo('home');
  } else {
    currentUser = null;
    const listContainer = document.getElementById('transactions-list');
    if (listContainer) listContainer.innerHTML = '';
    navigateTo('login');
  }
});

// SIGN UP FORM HANDLER
document.getElementById('form-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    document.getElementById('display-username').innerText = name;
    await loadTransactions();
    navigateTo('home');
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      alert("This email address is already in use by another account.");
    } else {
      alert(err.message);
    }
  }
});

// SIGN IN FORM HANDLER
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert(err.message);
  }
});

// FORGOT PASSWORD HANDLER
document.getElementById('form-forgot').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value;
  try {
    await sendPasswordResetEmail(auth, email);
    alert('Password reset link sent to your email address.');
    navigateTo('login');
  } catch (err) {
    alert(err.message);
  }
});

// LOGOUT HANDLER
document.getElementById('btn-logout').addEventListener('click', () => {
  currentUser = null;
  signOut(auth);
});

document.getElementById('goto-login').onclick = (e) => { e.preventDefault(); navigateTo('login'); };
document.getElementById('goto-signup').onclick = (e) => { e.preventDefault(); navigateTo('signup'); };
document.getElementById('goto-forgot').onclick = (e) => { e.preventDefault(); navigateTo('forgot'); };
document.getElementById('back-to-login').onclick = (e) => { e.preventDefault(); navigateTo('login'); };

// PROFILE MANAGEMENT HANDLERS (With Password Confirmation)
document.getElementById('btn-open-profile').onclick = () => {
  if (currentUser) {
    document.getElementById('profile-name').value = currentUser.displayName || '';
    document.getElementById('profile-email').value = currentUser.email || '';
    document.getElementById('profile-name-password').value = '';
    document.getElementById('profile-email-password').value = '';
    navigateTo('profile');
  }
};

document.getElementById('btn-profile-back').onclick = () => navigateTo('home');

// Update Name after confirming login password
document.getElementById('form-update-profile').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('profile-name').value;
  const pwd = document.getElementById('profile-name-password').value;

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, pwd);
    await reauthenticateWithCredential(currentUser, credential);

    await updateProfile(currentUser, { displayName: name });
    document.getElementById('display-username').innerText = name;
    document.getElementById('profile-name-password').value = '';
    alert('Profile name updated successfully!');
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      alert("Incorrect password. Please enter your valid login password.");
    } else {
      alert("Authentication failed: " + err.message);
    }
  }
});

// Update Email after confirming login password (checks existing account first)
document.getElementById('form-update-email').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newEmail = document.getElementById('profile-email').value.trim();
  const pwd = document.getElementById('profile-email-password').value;

  if (newEmail === currentUser.email) {
    alert('Please enter a new email address different from your current one.');
    return;
  }

  try {
    // 1. Re-authenticate user with current credentials
    const credential = EmailAuthProvider.credential(currentUser.email, pwd);
    await reauthenticateWithCredential(currentUser, credential);

    // 2. Explicitly check if the new email is already registered to another account
    const signInMethods = await fetchSignInMethodsForEmail(auth, newEmail);
    if (signInMethods.length > 0) {
      alert("This email address is already in use by another account.");
      return;
    }

    // 3. Send verification link to new email if available
    await verifyBeforeUpdateEmail(currentUser, newEmail);
    document.getElementById('profile-email-password').value = '';
    alert(`A verification link has been sent to ${newEmail}. Please verify it from your inbox to finalize the email change.`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      alert("This email address is already in use by another account.");
    } else if (err.code === 'auth/invalid-email') {
      alert("The email address provided is invalid.");
    } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      alert("Incorrect password. Please enter your valid login password.");
    } else {
      alert("Authentication error: " + err.message);
    }
  }
});

// TRANSACTIONS LOGIC
function resetCreateForm() {
  editingTxId = null;
  document.getElementById('create-screen-title').innerText = 'Add Transaction';
  document.getElementById('form-create-transaction').reset();
  
  // Default to current date and time
  const now = new Date();
  const localIsoStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('tx-datetime').value = localIsoStr;

  selectedType = 'expense';
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === 'expense');
  });

  selectedCategory = 'Food';
  document.querySelectorAll('.cat-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === 'Food');
  });
}

document.getElementById('btn-goto-create').onclick = () => {
  resetCreateForm();
  navigateTo('create');
};

document.getElementById('btn-back-home').onclick = () => navigateTo('home');

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    const target = e.target.closest('.type-btn');
    target.classList.add('active');
    selectedType = target.dataset.type;
  });
});

document.querySelectorAll('.cat-chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    const target = e.target.closest('.cat-chip');
    target.classList.add('active');
    selectedCategory = target.dataset.cat;
  });
});

// Save / Update Transaction Handler
document.getElementById('form-create-transaction').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const title = document.getElementById('tx-title').value;
  const datetimeVal = document.getElementById('tx-datetime').value;

  if (!amount || !title) {
    alert('Please provide a valid description and amount.');
    return;
  }

  const txData = {
    userId: currentUser.uid,
    title: title,
    amount: amount,
    type: selectedType,
    category: selectedCategory,
    datetime: datetimeVal || new Date().toISOString(),
    createdAt: serverTimestamp()
  };

  try {
    if (editingTxId) {
      await updateDoc(doc(db, 'transactions', editingTxId), txData);
      alert('Transaction updated successfully!');
    } else {
      await addDoc(collection(db, 'transactions'), txData);
    }

    resetCreateForm();
    await loadTransactions();
    navigateTo('home');
  } catch (err) {
    alert(err.message);
  }
});

let allTransactionsMap = {};

async function loadTransactions() {
  if (!currentUser) return;

  try {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid)
    );

    const querySnapshot = await getDocs(q);
    const listContainer = document.getElementById('transactions-list');
    listContainer.innerHTML = '';
    allTransactionsMap = {};

    let totalBalance = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    const symbol = currencySymbols[currentCurrency];

    querySnapshot.forEach((docSnap) => {
      const tx = docSnap.data();
      const txId = docSnap.id;
      allTransactionsMap[txId] = tx;

      if (tx.type === 'income') {
        totalIncome += tx.amount;
        totalBalance += tx.amount;
      } else {
        totalExpense += tx.amount;
        totalBalance -= tx.amount;
      }

      // Format display date
      let dateDisplay = '';
      if (tx.datetime) {
        const d = new Date(tx.datetime);
        dateDisplay = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      const txElement = document.createElement('div');
      txElement.className = 'tx-item';
      txElement.innerHTML = `
        <div class="tx-left">
          <div class="tx-icon"><i class="fa-solid fa-wallet"></i></div>
          <div class="tx-details">
            <h4>${tx.title}</h4>
            <p>${tx.category} ${dateDisplay ? '• ' + dateDisplay : ''}</p>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${symbol}${tx.amount.toFixed(2)}</div>
          <button class="btn-edit" data-id="${txId}" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-delete" data-id="${txId}" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `;

      listContainer.appendChild(txElement);
    });

    // Delete Warning Confirmation Handler
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.onclick = async (e) => {
        const confirmDelete = confirm("Warning: Are you sure you want to permanently delete this transaction?");
        if (!confirmDelete) return;

        const id = e.target.closest('.btn-delete').dataset.id;
        await deleteDoc(doc(db, 'transactions', id));
        await loadTransactions();
      };
    });

    // Edit Button Handler
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.target.closest('.btn-edit').dataset.id;
        const tx = allTransactionsMap[id];
        if (!tx) return;

        editingTxId = id;
        document.getElementById('create-screen-title').innerText = 'Edit Transaction';
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-title').value = tx.title;

        if (tx.datetime) {
          document.getElementById('tx-datetime').value = tx.datetime;
        }

        selectedType = tx.type;
        document.querySelectorAll('.type-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.type === tx.type);
        });

        selectedCategory = tx.category;
        document.querySelectorAll('.cat-chip').forEach(c => {
          c.classList.toggle('active', c.dataset.cat === tx.category);
        });

        navigateTo('create');
      };
    });

    document.getElementById('total-balance').innerText = `${symbol}${totalBalance.toFixed(2)}`;
    document.getElementById('total-income').innerText = `+${symbol}${totalIncome.toFixed(2)}`;
    document.getElementById('total-expense').innerText = `-${symbol}${totalExpense.toFixed(2)}`;
  } catch (err) {
    if (currentUser) {
      console.error("Firestore Error: ", err);
    }
  }
}

// PULL TO REFRESH FEATURE
const ptrIndicator = document.getElementById('ptr-indicator');
let startY = 0;
let currentY = 0;
let isRefreshing = false;

window.addEventListener('touchstart', (e) => {
  if (window.scrollY === 0) startY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  currentY = e.touches[0].clientY;
  const distance = currentY - startY;

  if (distance > 0 && window.scrollY === 0 && !isRefreshing) {
    const scale = Math.min(distance / 100, 1);
    ptrIndicator.style.transform = `translateX(-50%) scale(${scale})`;
  }
}, { passive: true });

window.addEventListener('touchend', async () => {
  const distance = currentY - startY;
  if (distance > 70 && window.scrollY === 0 && !isRefreshing) {
    isRefreshing = true;
    ptrIndicator.style.transform = 'translateX(-50%) scale(1) rotate(180deg)';
    
    if (currentUser) await loadTransactions();
    
    setTimeout(() => {
      ptrIndicator.style.transform = 'translateX(-50%) scale(0)';
      isRefreshing = false;
      startY = 0;
      currentY = 0;
    }, 500);
  } else {
    ptrIndicator.style.transform = 'translateX(-50%) scale(0)';
  }
});


// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.log('Service Worker registration failed:', err));
  });
                                                       }
  
