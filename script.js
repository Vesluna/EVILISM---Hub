// ═══════════════════════════════════════════════════════════════
// EVILISM HUB — Application Script
// ═══════════════════════════════════════════════════════════════

// Configuration
const CONFIG = {
    DISCORD_CLIENT_ID: '1502178686705860698',
    BACKEND_URL: 'https://evilism-bot-production.up.railway.app',
    GUILD_ID: '1502137521491153037',
    ROLE_HIERARCHY: {
        'umbra': 5,
        'TDC: Heads': 4,
        'The Dark Council': 3,
        'Sinister Sorcerers': 2,
        'Acolytes of Evil': 1
    }
};

// Application State
const app = {
    state: {
        user: null,
        token: null,
        userRole: null,
        userRankTier: 0,
        news: [],
        trials: [],
        votes: [],
        events: [],
        bounties: [],
        currentSection: 'home'
    },

    // Initialize Application
    init() {
        this.loadState();
        this.updateUI();
    },

    // Load state from localStorage
    loadState() {
        const saved = localStorage.getItem('evilism-hub-state');
        if (saved) {
            try {
                this.state = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load state:', e);
            }
        }
    },

    // Save state to localStorage
    saveState() {
        localStorage.setItem('evilism-hub-state', JSON.stringify(this.state));
    },

    // Discord OAuth Login
    loginWithDiscord() {
        const state = this.generateState();
        sessionStorage.setItem('oauth_state', state);
        
        const params = new URLSearchParams({
            client_id: CONFIG.DISCORD_CLIENT_ID,
            redirect_uri: `${CONFIG.BACKEND_URL}/api/hub/auth/callback`,
            response_type: 'code',
            scope: 'identify guilds',
            state: state
        });

        window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
    },

    // Generate random state for OAuth
    generateState() {
        try {
            const arr = new Uint8Array(16);
            crypto.getRandomValues(arr);
            return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            // Fallback for environments without crypto
            return Math.random().toString(36).substr(2, 16);
        }
    },

    // Handle OAuth Callback
    handleOAuthCallback() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const error = params.get('error');

        if (error) {
            console.error('OAuth error:', error);
            alert('Login failed: ' + error);
            return;
        }

        if (!token) {
            return;
        }

        // Store token and fetch user info
        this.state.token = token;
        this.fetchUserInfo();
        window.history.replaceState({}, document.title, window.location.pathname);
    },

    // Fetch user info from backend
    async fetchUserInfo() {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/hub/me`, {
                headers: {
                    'Authorization': `Bearer ${this.state.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user info');
            }

            const data = await response.json();
            this.state.user = {
                id: data.id,
                username: data.username,
                avatar: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'
            };
            this.state.userRole = data.role || 'Acolytes of Evil';
            this.state.userRankTier = data.tier || 1;

            this.saveState();
            this.updateUI();
            showSection('portal');
        } catch (error) {
            console.error('Error fetching user info:', error);
            alert('Failed to load user information. Please try logging in again.');
        }
    },

    // Update UI based on auth state
    updateUI() {
        const authContainer = document.getElementById('auth-container');
        const portalLink = document.getElementById('portal-link');

        if (this.state.user && this.state.token) {
            authContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="color: var(--text-secondary);">${this.escapeHtml(this.state.user.username)}</span>
                    <span style="color: var(--accent); font-weight: 600;">${this.escapeHtml(this.state.userRole)}</span>
                    <button class="auth-btn logout" onclick="app.logout()">Logout</button>
                </div>
            `;
            portalLink.classList.remove('hidden');
            this.updateFormVisibility();
        } else {
            authContainer.innerHTML = '<button class="auth-btn" onclick="app.loginWithDiscord()">Login with Discord</button>';
            portalLink.classList.add('hidden');
        }
    },

    // Update form visibility based on role
    updateFormVisibility() {
        const tier = this.state.userRankTier;
        
        // TDC+ (tier 3+) can post news
        document.getElementById('news-form-container').classList.toggle('hidden', tier < 3);
        
        // TDC: Heads+ (tier 4+) can create trials
        document.getElementById('trials-form-container').classList.toggle('hidden', tier < 4);
        
        // TDC+ (tier 3+) can create events
        document.getElementById('events-form-container').classList.toggle('hidden', tier < 3);
        
        // TDC+ (tier 3+) can post bounties
        document.getElementById('bounties-form-container').classList.toggle('hidden', tier < 3);
    },

    // Logout
    async logout() {
        this.state = {
            user: null,
            token: null,
            userRole: null,
            userRankTier: 0,
            news: [],
            trials: [],
            votes: [],
            events: [],
            bounties: [],
            currentSection: 'home'
        };
        this.saveState();
        this.updateUI();
        showSection('home');
    },

    // News Feed Functions
    postNews() {
        if (this.state.userRankTier < 3) {
            alert('You do not have permission to post news.');
            return;
        }

        const title = document.getElementById('news-title').value.trim();
        const content = document.getElementById('news-content').value.trim();

        if (!title || !content) {
            alert('Please fill in all fields.');
            return;
        }

        const newsItem = {
            id: 'news-' + Date.now(),
            title,
            content,
            author: this.state.user.username,
            timestamp: new Date().toISOString(),
            authorId: this.state.user.id
        };

        this.state.news.unshift(newsItem);
        this.saveState();

        document.getElementById('news-title').value = '';
        document.getElementById('news-content').value = '';

        this.loadNews();
    },

    loadNews() {
        const feed = document.getElementById('news-feed');
        feed.innerHTML = '';

        if (this.state.news.length === 0) {
            feed.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No news yet. Be the first to share!</p>';
            return;
        }

        this.state.news.forEach(item => {
            const date = new Date(item.timestamp).toLocaleDateString();
            const canEdit = this.state.user && (item.authorId === this.state.user.id || this.state.userRankTier >= 4);

            const newsHTML = `
                <div class="news-item">
                    <div class="news-header">
                        <div>
                            <div class="news-title">${this.escapeHtml(item.title)}</div>
                            <div class="news-meta">By ${this.escapeHtml(item.author)} • ${date}</div>
                        </div>
                        ${canEdit ? `
                            <div class="news-actions">
                                <button class="btn-small btn-delete" onclick="app.deleteNews('${item.id}')">Delete</button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="news-content">${this.escapeHtml(item.content)}</div>
                </div>
            `;
            feed.innerHTML += newsHTML;
        });
    },

    deleteNews(id) {
        if (confirm('Are you sure you want to delete this news item?')) {
            this.state.news = this.state.news.filter(item => item.id !== id);
            this.saveState();
            this.loadNews();
        }
    },

    // Trials Functions
    createTrial() {
        if (this.state.userRankTier < 4) {
            alert('You do not have permission to create trials.');
            return;
        }

        const name = document.getElementById('trial-name').value.trim();
        const description = document.getElementById('trial-description').value.trim();

        if (!name || !description) {
            alert('Please fill in all fields.');
            return;
        }

        const trial = {
            id: 'trial-' + Date.now(),
            name,
            description,
            stage: 'opening',
            creator: this.state.user.username,
            timestamp: new Date().toISOString(),
            participants: 0
        };

        this.state.trials.unshift(trial);
        this.saveState();

        document.getElementById('trial-name').value = '';
        document.getElementById('trial-description').value = '';

        this.loadTrials();
    },

    loadTrials() {
        const list = document.getElementById('trials-list');
        list.innerHTML = '';

        if (this.state.trials.length === 0) {
            list.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No active trials. Check back soon!</p>';
            return;
        }

        this.state.trials.forEach(trial => {
            const stageClass = trial.stage.toLowerCase();
            const trialHTML = `
                <div class="trial-card">
                    <span class="trial-stage ${stageClass}">${trial.stage}</span>
                    <h3 style="color: var(--accent); margin-bottom: 0.5rem;">${this.escapeHtml(trial.name)}</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">${this.escapeHtml(trial.description)}</p>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">
                        Created by ${this.escapeHtml(trial.creator)} • ${trial.participants} participants
                    </div>
                </div>
            `;
            list.innerHTML += trialHTML;
        });
    },

    // Voting Functions
    loadVoting() {
        const list = document.getElementById('voting-list');
        list.innerHTML = '';

        if (this.state.votes.length === 0) {
            list.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No active votes. Check back soon!</p>';
            return;
        }

        this.state.votes.forEach(vote => {
            const voteHTML = `
                <div class="vote-card">
                    <h3 style="color: var(--accent); margin-bottom: 0.5rem;">${this.escapeHtml(vote.title)}</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">${this.escapeHtml(vote.description)}</p>
                    <div class="vote-options">
                        ${vote.options.map(opt => `
                            <button class="vote-btn" onclick="app.castVote('${vote.id}', '${opt}')">${this.escapeHtml(opt)}</button>
                        `).join('')}
                    </div>
                </div>
            `;
            list.innerHTML += voteHTML;
        });
    },

    castVote(voteId, option) {
        console.log(`Vote cast: ${voteId} - ${option}`);
        alert('Your anonymous vote has been recorded.');
    },

    // Events Functions
    createEvent() {
        if (this.state.userRankTier < 3) {
            alert('You do not have permission to create events.');
            return;
        }

        const title = document.getElementById('event-title').value.trim();
        const description = document.getElementById('event-description').value.trim();
        const date = document.getElementById('event-date').value;

        if (!title || !description || !date) {
            alert('Please fill in all fields.');
            return;
        }

        const event = {
            id: 'event-' + Date.now(),
            title,
            description,
            date,
            creator: this.state.user.username,
            attendees: 0
        };

        this.state.events.unshift(event);
        this.saveState();

        document.getElementById('event-title').value = '';
        document.getElementById('event-description').value = '';
        document.getElementById('event-date').value = '';

        this.loadEvents();
    },

    loadEvents() {
        const list = document.getElementById('events-list');
        list.innerHTML = '';

        if (this.state.events.length === 0) {
            list.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No upcoming events. Check back soon!</p>';
            return;
        }

        this.state.events.forEach(event => {
            const eventDate = new Date(event.date).toLocaleDateString();
            const eventHTML = `
                <div class="event-card">
                    <div class="event-date">📅 ${eventDate}</div>
                    <div class="event-title">${this.escapeHtml(event.title)}</div>
                    <div class="event-description">${this.escapeHtml(event.description)}</div>
                    <div class="event-actions">
                        <button class="btn btn-primary" onclick="app.attendEvent('${event.id}')">Attend</button>
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">${event.attendees} attending</span>
                    </div>
                </div>
            `;
            list.innerHTML += eventHTML;
        });
    },

    attendEvent(eventId) {
        const event = this.state.events.find(e => e.id === eventId);
        if (event) {
            event.attendees++;
            this.saveState();
            this.loadEvents();
            alert('You have marked yourself as attending!');
        }
    },

    // Bounties Functions
    createBounty() {
        if (this.state.userRankTier < 3) {
            alert('You do not have permission to post bounties.');
            return;
        }

        const target = document.getElementById('bounty-target').value.trim();
        const description = document.getElementById('bounty-description').value.trim();
        const reward = document.getElementById('bounty-reward').value.trim();

        if (!target || !description) {
            alert('Please fill in all fields.');
            return;
        }

        const bounty = {
            id: 'bounty-' + Date.now(),
            target,
            description,
            reward: reward || 'TBD',
            creator: this.state.user.username,
            timestamp: new Date().toISOString()
        };

        this.state.bounties.unshift(bounty);
        this.saveState();

        document.getElementById('bounty-target').value = '';
        document.getElementById('bounty-description').value = '';
        document.getElementById('bounty-reward').value = '';

        this.loadBounties();
    },

    loadBounties() {
        const list = document.getElementById('bounties-list');
        list.innerHTML = '';

        if (this.state.bounties.length === 0) {
            list.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No active bounties. Check back soon!</p>';
            return;
        }

        this.state.bounties.forEach(bounty => {
            const bountyHTML = `
                <div class="bounty-card">
                    <div class="bounty-target">🎯 ${this.escapeHtml(bounty.target)}</div>
                    <div class="bounty-description">${this.escapeHtml(bounty.description)}</div>
                    <div class="bounty-reward">Reward: ${this.escapeHtml(bounty.reward)}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Posted by ${this.escapeHtml(bounty.creator)}</div>
                </div>
            `;
            list.innerHTML += bountyHTML;
        });
    },

    // Profile Functions
    loadProfile() {
        const content = document.getElementById('profile-content');

        if (!this.state.user) {
            content.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">Please log in to view your profile.</p>';
            return;
        }

        const profileHTML = `
            <div class="profile-header">
                <img src="${this.state.user.avatar}" alt="Avatar" class="profile-avatar">
                <div class="profile-name">${this.escapeHtml(this.state.user.username)}</div>
                <div class="profile-rank">${this.escapeHtml(this.state.userRole)}</div>
                <div class="profile-stats">
                    <div class="stat-card">
                        <div class="stat-value">${this.state.news.filter(n => n.authorId === this.state.user.id).length}</div>
                        <div class="stat-label">News Posted</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${this.state.events.filter(e => e.creator === this.state.user.username).length}</div>
                        <div class="stat-label">Events Created</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">0</div>
                        <div class="stat-label">Votes Cast</div>
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = profileHTML;
    },

    // Utility: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Modal Functions
    closeModal() {
        document.getElementById('modal').classList.remove('active');
    }
};

// Global Functions
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
        app.state.currentSection = sectionId;

        // Load section data
        if (sectionId === 'news') app.loadNews();
        if (sectionId === 'trials') app.loadTrials();
        if (sectionId === 'voting') app.loadVoting();
        if (sectionId === 'events') app.loadEvents();
        if (sectionId === 'bounties') app.loadBounties();
        if (sectionId === 'profile') app.loadProfile();
    }

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    event?.target?.classList.add('active');

    app.saveState();
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    app.init();
    // Check if we're returning from OAuth callback
    if (window.location.search.includes('token=') || window.location.search.includes('error=')) {
        app.handleOAuthCallback();
    }
});
