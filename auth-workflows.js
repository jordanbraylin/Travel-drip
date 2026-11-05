/* Account actions use Supabase Auth; credentials never enter application logs. */
(() => {
  function create({ getClient, getSession, getConfig, message, onRecoveryFinished, onMfaVerified }) {
    const recoveryRequested = new URLSearchParams(location.search).get('recovery') === 'true'
      || new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
    let recoveryActive = recoveryRequested;
    let mfaRequired = false;
    let mfaCheck;
    let recoveryDialog;
    let dialog;
    function open(title, description) {
      if (dialog?.open) dialog.close();
      dialog?.remove();
      dialog = document.createElement('dialog');
      dialog.className = 'auth-workflow-dialog';
      dialog.setAttribute('aria-labelledby', 'authWorkflowTitle');
      dialog.innerHTML = '<form><h2 id="authWorkflowTitle"></h2><p class="auth-workflow-description"></p><div class="auth-workflow-fields"></div><p role="status" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="ghost-button">Close</button><button type="submit" class="primary-button">Continue</button></div></form>';
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('.auth-workflow-description').textContent = description;
      document.body.append(dialog);
      const form = dialog.querySelector('form');
      const close = form.querySelector('[type="button"]');
      close.addEventListener('click', () => dialog.close());
      // Clear passwords, authenticator codes and QR material when dismissed.
      dialog.addEventListener('close', () => {
        form.reset();
        form.querySelector('.auth-workflow-fields').replaceChildren();
      }, { once: true });
      dialog.showModal();
      return { dialog, form, fields: form.querySelector('.auth-workflow-fields'), status: form.querySelector('[role="status"]'), submit: form.querySelector('[type="submit"]') };
    }
    function field(view, label, type, autocomplete) {
      const wrapper = document.createElement('label');
      wrapper.textContent = label;
      const input = document.createElement('input');
      input.type = type;
      input.autocomplete = autocomplete;
      input.required = true;
      wrapper.append(input);
      view.fields.append(wrapper);
      return input;
    }
    function submit(view, action) {
      let busy = false;
      view.form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !view.form.reportValidity()) return;
        busy = true;
        view.submit.disabled = true;
        view.status.textContent = 'Please wait…';
        try { await action(); }
        catch (error) { view.status.textContent = error?.message || 'This request could not be completed. Please try again.'; }
        finally { busy = false; view.submit.disabled = false; }
      });
    }
    function client() {
      const value = getClient();
      if (!value) throw new Error('Account service is not connected. Please reload and try again.');
      return value;
    }
    function emailAction(kind) {
      const reset = kind === 'reset';
      const view = open(reset ? 'Reset your password' : 'Verify your email', reset
        ? 'Enter your account email. We will send a secure link so you can choose a new password.'
        : 'Enter the email you used to register to request a new verification link.');
      const email = field(view, 'Account email', 'email', 'email');
      view.submit.textContent = reset ? 'Send reset link' : 'Send verification link';
      submit(view, async () => {
        const auth = client().auth;
        const address = email.value.trim().toLowerCase();
        const redirectTo = new URL(reset ? '/login?recovery=true' : '/login?verified=true', location.origin).href;
        const result = reset
          ? await auth.resetPasswordForEmail(address, { redirectTo })
          : await auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: redirectTo } });
        if (result.error) throw result.error;
        view.status.textContent = reset
          ? 'If this email has an eligible account, a reset link has been requested. Check your inbox and spam folder.'
          : 'If this account needs verification, a verification link has been requested. Check your inbox and spam folder.';
        message(view.status.textContent);
      });
      email.focus();
    }
    function recovery() {
      if (recoveryDialog?.open) return;
      recoveryActive = true;
      const view = open('Choose a new password', 'Open the secure recovery link from your email before saving a new password.');
      recoveryDialog = view.dialog;
      const password = field(view, 'New password', 'password', 'new-password');
      password.minLength = 8;
      const confirm = field(view, 'Confirm new password', 'password', 'new-password');
      confirm.minLength = 8;
      view.dialog.addEventListener('close', () => {
        if (!recoveryActive) return;
        recoveryActive = false;
        client().auth.signOut({ scope: 'local' }).then(() => {
          onRecoveryFinished();
          message('Password recovery closed. Sign in or request a new reset link.');
        }).catch(() => message('Please sign out before continuing.'));
      }, { once: true });
      view.submit.textContent = 'Save new password';
      submit(view, async () => {
        if (!getSession()?.user) throw new Error('This recovery link is expired or invalid. Request a new reset link.');
        if (password.value !== confirm.value) throw new Error('The passwords do not match.');
        const { error } = await client().auth.updateUser({ password: password.value });
        if (error) throw error;
        password.value = '';
        confirm.value = '';
        const { error: signOutError } = await client().auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
        recoveryActive = false;
        view.dialog.close();
        onRecoveryFinished();
        message('Password updated. Sign in with your new password.');
      });
    }
    function legal(kind) {
      const title = kind === 'Terms of Service' ? 'Terms of Service' : 'Privacy Policy';
      const view = open(title, 'Read the current Travel-Drip policy below. Closing this window does not accept it.');
      view.submit.hidden = true;
      const frame = document.createElement('iframe');
      frame.title = title;
      frame.src = title === 'Terms of Service' ? '/terms.html' : '/privacy.html';
      frame.setAttribute('sandbox', 'allow-same-origin');
      view.fields.append(frame);
      view.form.addEventListener('submit', event => event.preventDefault());
    }
    async function oauth(provider) {
      if (!['google', 'apple'].includes(provider)) return;
      const label = provider === 'google' ? 'Google' : 'Apple';
      try {
        const config = getConfig();
        const response = await fetch(new URL('/auth/v1/settings', config.supabaseUrl), {
          headers: { apikey: config.supabaseAnonKey }, signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error('Could not check social sign-in availability. Use email or username sign-in.');
        const settings = await response.json();
        if (settings.external?.[provider] !== true) {
          message(`${label} sign-in is not connected yet. Please use your email or username and password. You have not left Travel-Drip.`);
          return;
        }
        const { error } = await client().auth.signInWithOAuth({ provider, options: { redirectTo: new URL('/login', location.origin).href } });
        if (error) throw error;
      } catch (error) { message(error.message || 'Social sign-in could not start. Use email or username sign-in.'); }
    }
    async function mfa() {
      if (!getSession()?.user) {
        message('Sign in first, then open Account → Password & Security to manage two-factor authentication.');
        return;
      }
      const ownerId = getSession().user.id;
      const view = open('Two-factor authentication', 'Use an authenticator app to protect your Travel-Drip account.');
      view.submit.hidden = true;
      try {
        const auth = client().auth;
        const { data, error } = await auth.mfa.listFactors();
        if (error) throw error;
        if (getSession()?.user?.id !== ownerId || !view.dialog.open) return;
        let factor = data.totp?.find(item => item.status === 'verified');
        const setup = !factor;
        view.status.textContent = setup ? 'Two-factor authentication is not enabled.' : 'Authenticator protection is enabled. Enter a code to verify this session.';
        view.submit.hidden = false;
        view.submit.textContent = setup ? 'Set up authenticator' : 'Verify code';
        let code;
        if (factor) {
          code = field(view, 'Authenticator code', 'text', 'one-time-code');
          code.inputMode = 'numeric'; code.pattern = '[0-9]{6}';
        }
        submit(view, async () => {
          if (getSession()?.user?.id !== ownerId) throw new Error('Your account changed. Close this window and sign in again.');
          if (!factor) {
            // Reuse an unfinished enrollment rather than accumulating orphan factors.
            for (const item of data.totp || []) {
              if (item.status === 'unverified') {
                const removed = await auth.mfa.unenroll({ factorId: item.id });
                if (removed.error) throw removed.error;
              }
            }
            const enrolled = await auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Travel-Drip authenticator' });
            if (enrolled.error) throw enrolled.error;
            factor = enrolled.data;
            if (!view.dialog.open || getSession()?.user?.id !== ownerId) return;
            const qr = document.createElement('img');
            qr.alt = 'Scan this code in your authenticator app';
            qr.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(factor.totp.qr_code)}`;
            qr.width = 200; qr.height = 200;
            view.fields.append(qr);
            code = field(view, 'Authenticator code', 'text', 'one-time-code');
            code.inputMode = 'numeric'; code.pattern = '[0-9]{6}';
            view.status.textContent = 'Scan the QR code, then enter its six-digit code. Protection is enabled only after verification.';
            view.submit.textContent = 'Enable two-factor authentication';
            return;
          }
          const result = await auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.value.trim() });
          code.value = '';
          if (result.error) throw result.error;
          if (getSession()?.user?.id !== ownerId) return;
          mfaRequired = false;
          view.dialog.close();
          message('Authenticator verified. Two-factor authentication is enabled for your account.');
          onMfaVerified?.();
        });
      } catch (error) { view.status.textContent = error.message || 'Two-factor authentication could not load.'; }
    }
    function run(workflow) {
      if (workflow === 'Terms of Service' || workflow === 'Privacy Policy') return legal(workflow);
      if (workflow === 'Forgot Password' || workflow === 'Reset Password') return emailAction('reset');
      if (workflow === 'Verify Email') return emailAction('verify');
      if (workflow === 'Two-Factor Authentication') return mfa();
      message('This account action is not available yet. No changes have been made.');
    }
    function checkMfa() {
      if (mfaCheck) return mfaCheck;
      mfaCheck = (async () => {
        if (!getSession()?.user || recoveryActive) { mfaRequired = false; return false; }
        const ownerId = getSession().user.id;
        const { data, error } = await client().auth.mfa.getAuthenticatorAssuranceLevel();
        if (getSession()?.user?.id !== ownerId) return true;
        if (error) { mfaRequired = true; throw error; }
        mfaRequired = data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
        if (mfaRequired) await mfa();
        return mfaRequired;
      })().finally(() => { mfaCheck = null; });
      return mfaCheck;
    }
    return { run, oauth, recovery, checkMfa, isRecovery: () => recoveryActive, isBlocked: () => recoveryActive || mfaRequired };
  }
  window.TravelDripAuthWorkflows = { create };
})();
