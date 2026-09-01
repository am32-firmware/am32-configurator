<template>
  <div class="pt-4 flex items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold">
            Admin Login
          </h1>
          <p class="text-gray-400 mt-2">
            Sign in to access the admin panel
          </p>
        </div>
      </template>

      <UForm
        class="space-y-4"
        :state="form"
        @submit="handleLogin"
      >
        <UFormGroup
          label="Username"
          name="username"
        >
          <UInput
            v-model="form.username"
            placeholder="Enter username"
            icon="i-mdi-account"
            :disabled="loading"
          />
        </UFormGroup>

        <UFormGroup
          label="Password"
          name="password"
        >
          <UInput
            v-model="form.password"
            type="password"
            placeholder="Enter password"
            icon="i-mdi-lock"
            :disabled="loading"
          />
        </UFormGroup>

        <UAlert
          v-if="error"
          icon="i-mdi-alert-circle"
          color="red"
          variant="soft"
          :title="error"
          class="mb-4"
        />

        <UButton
          type="submit"
          block
          :loading="loading"
          :disabled="loading"
        >
          Sign In
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const router = useRouter();
const form = reactive({
    username: '',
    password: ''
});
const loading = ref(false);
const error = ref('');

// Check if already logged in
onMounted(async () => {
    try {
        await $fetch('/api/admin/session');
        router.push('/admin/sponsors');
    } catch {
        // Not logged in, stay on login page
    }
});

async function handleLogin () {
    loading.value = true;
    error.value = '';

    try {
        await $fetch('/api/admin/login', {
            method: 'POST',
            body: {
                username: form.username,
                password: form.password
            }
        });

        router.push('/admin/sponsors');
    } catch (err: any) {
        error.value = err.data?.statusMessage || 'Login failed. Please try again.';
    } finally {
        loading.value = false;
    }
}
</script>
