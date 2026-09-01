<template>
  <div class="min-h-screen bg-gray-900">
    <!-- Header -->
    <header class="bg-gray-800 border-b border-gray-700">
      <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <NuxtLink
            to="/"
            class="text-xl font-bold text-red-500"
          >
            AM32 Admin
          </NuxtLink>
          <span class="text-gray-400">|</span>
          <div class="flex items-center gap-4">
            <NuxtLink
              to="/admin/sponsors"
              class="text-gray-300 hover:text-white transition-colors"
            >
              Sponsors
            </NuxtLink>
            <span class="text-gray-500">|</span>
            <span class="text-white font-medium">Users</span>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-gray-400 text-sm">{{ username }}</span>
          <UButton
            color="red"
            variant="soft"
            icon="i-mdi-logout"
            @click="handleLogout"
          >
            Logout
          </UButton>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">
          Users
        </h1>
        <UButton
          icon="i-mdi-plus"
          @click="openCreateModal"
        >
          Add User
        </UButton>
      </div>

      <!-- Loading State -->
      <div
        v-if="loading"
        class="flex justify-center py-12"
      >
        <UIcon
          name="i-mdi-loading"
          class="animate-spin text-4xl text-red-500"
        />
      </div>

      <!-- Empty State -->
      <UCard
        v-else-if="users.length === 0"
        class="text-center py-12"
      >
        <UIcon
          name="i-mdi-account-off"
          class="text-6xl text-gray-500 mb-4"
        />
        <h2 class="text-xl font-semibold text-gray-300 mb-2">
          No Users Yet
        </h2>
        <p class="text-gray-400 mb-4">
          Add your first user to get started
        </p>
        <UButton
          icon="i-mdi-plus"
          @click="openCreateModal"
        >
          Add User
        </UButton>
      </UCard>

      <!-- Users Table -->
      <UCard v-else>
        <UTable
          :rows="users"
          :columns="columns"
          :loading="loading"
        >
          <template #role-data="{ row }">
            <UBadge
              :color="row.role === 'admin' ? 'red' : 'gray'"
              variant="soft"
            >
              {{ row.role }}
            </UBadge>
          </template>

          <template #active-data="{ row }">
            <UBadge
              :color="row.active ? 'green' : 'gray'"
              variant="soft"
            >
              {{ row.active ? 'Active' : 'Inactive' }}
            </UBadge>
          </template>

          <template #createdAt-data="{ row }">
            <span class="text-gray-400">
              {{ formatDate(row.createdAt) }}
            </span>
          </template>

          <template #actions-data="{ row }">
            <div class="flex gap-2">
              <UButton
                color="blue"
                variant="soft"
                icon="i-mdi-pencil"
                size="sm"
                @click="openEditModal(row)"
              />
              <UButton
                color="red"
                variant="soft"
                icon="i-mdi-delete"
                size="sm"
                :disabled="deleting"
                @click="confirmDelete(row)"
              />
            </div>
          </template>
        </UTable>
      </UCard>
    </main>

    <!-- Create/Edit Modal -->
    <UModal v-model="showModal">
      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold">
              {{ editingUser ? 'Edit User' : 'Add User' }}
            </h2>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-mdi-close"
              @click="closeModal"
            />
          </div>
        </template>

        <UForm
          class="space-y-4"
          :state="form"
          @submit="handleSubmit"
        >
          <UFormGroup
            label="Username"
            name="username"
            required
          >
            <UInput
              v-model="form.username"
              placeholder="Enter username"
              :disabled="submitting"
              icon="i-mdi-account"
            />
          </UFormGroup>

          <UFormGroup
            label="Email"
            name="email"
          >
            <UInput
              v-model="form.email"
              type="email"
              placeholder="user@example.com"
              :disabled="submitting"
              icon="i-mdi-email"
            />
          </UFormGroup>

          <UFormGroup
            label="Password"
            name="password"
            :required="!editingUser"
          >
            <UInput
              v-model="form.password"
              type="password"
              :placeholder="editingUser ? 'Leave empty to keep current' : 'Enter password'"
              :disabled="submitting"
              icon="i-mdi-lock"
            />
          </UFormGroup>

          <UFormGroup
            label="Role"
            name="role"
          >
            <USelect
              v-model="form.role"
              :options="roleOptions"
              :disabled="submitting"
            />
          </UFormGroup>

          <UFormGroup
            v-if="editingUser"
            label="Status"
            name="active"
          >
            <UToggle
              v-model="form.active"
              :disabled="submitting"
            />
            <span class="ml-2 text-sm text-gray-400">
              {{ form.active ? 'Active' : 'Inactive' }}
            </span>
          </UFormGroup>

          <UAlert
            v-if="error"
            icon="i-mdi-alert-circle"
            color="red"
            variant="soft"
            :title="error"
          />

          <div class="flex justify-end gap-2 pt-4">
            <UButton
              color="gray"
              variant="soft"
              :disabled="submitting"
              @click="closeModal"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="submitting"
              :disabled="submitting"
            >
              {{ editingUser ? 'Update' : 'Create' }}
            </UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model="showDeleteModal">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 text-red-500">
            <UIcon
              name="i-mdi-alert"
              class="text-2xl"
            />
            <h2 class="text-xl font-bold">
              Delete User
            </h2>
          </div>
        </template>

        <p class="text-gray-300 mb-4">
          Are you sure you want to delete <strong>{{ deletingUser?.username }}</strong>?
          This action cannot be undone.
        </p>

        <div class="flex justify-end gap-2">
          <UButton
            color="gray"
            variant="soft"
            :disabled="deleting"
            @click="showDeleteModal = false"
          >
            Cancel
          </UButton>
          <UButton
            color="red"
            :loading="deleting"
            :disabled="deleting"
            @click="handleDelete"
          >
            Delete
          </UButton>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const router = useRouter();
const username = ref('');
const users = ref<User[]>([]);
const loading = ref(true);
const showModal = ref(false);
const showDeleteModal = ref(false);
const editingUser = ref<User | null>(null);
const deletingUser = ref<User | null>(null);
const submitting = ref(false);
const deleting = ref(false);
const error = ref('');

const form = reactive({
    username: '',
    email: '',
    password: '',
    role: 'user',
    active: true
});

const roleOptions = [
    { label: 'User', value: 'user' },
    { label: 'Admin', value: 'admin' }
];

const columns = [
    { key: 'username', label: 'Username' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'active', label: 'Status' },
    { key: 'createdAt', label: 'Created' },
    { key: 'actions', label: 'Actions' }
];

// Check authentication on mount
onMounted(async () => {
    try {
        const session = await $fetch<{ data: { username: string } }>('/api/admin/session');
        username.value = session.data.username;
        await fetchUsers();
    } catch {
        router.push('/admin');
    }
});

async function fetchUsers () {
    loading.value = true;
    try {
        const response = await $fetch<{ data: User[] }>('/api/admin/users');
        users.value = response.data;
    } catch (err: any) {
        if (err.statusCode === 401) {
            router.push('/admin');
        }
    } finally {
        loading.value = false;
    }
}

function openCreateModal () {
    editingUser.value = null;
    form.username = '';
    form.email = '';
    form.password = '';
    form.role = 'user';
    form.active = true;
    error.value = '';
    showModal.value = true;
}

function openEditModal (user: User) {
    editingUser.value = user;
    form.username = user.username;
    form.email = user.email || '';
    form.password = '';
    form.role = user.role;
    form.active = user.active;
    error.value = '';
    showModal.value = true;
}

function closeModal () {
    showModal.value = false;
    editingUser.value = null;
    error.value = '';
}

function confirmDelete (user: User) {
    deletingUser.value = user;
    showDeleteModal.value = true;
}

async function handleSubmit () {
    submitting.value = true;
    error.value = '';

    try {
        const payload: Record<string, any> = {
            username: form.username,
            email: form.email || null,
            role: form.role
        };

        if (form.password) {
            payload.password = form.password;
        }

        if (editingUser.value) {
            payload.active = form.active;
            await $fetch(`/api/admin/users/${editingUser.value.id}`, {
                method: 'PUT',
                body: payload
            });
        } else {
            if (!form.password) {
                error.value = 'Password is required';
                submitting.value = false;
                return;
            }
            payload.password = form.password;
            await $fetch('/api/admin/users', {
                method: 'POST',
                body: payload
            });
        }

        closeModal();
        await fetchUsers();
    } catch (err: any) {
        error.value = err.data?.statusMessage || 'An error occurred. Please try again.';
    } finally {
        submitting.value = false;
    }
}

async function handleDelete () {
    if (!deletingUser.value) {
        return;
    }

    deleting.value = true;
    try {
        await $fetch(`/api/admin/users/${deletingUser.value.id}`, {
            method: 'DELETE'
        });
        showDeleteModal.value = false;
        deletingUser.value = null;
        await fetchUsers();
    } catch (err: any) {
        if (err.statusCode === 401) {
            router.push('/admin');
        }
    } finally {
        deleting.value = false;
    }
}

async function handleLogout () {
    try {
        await $fetch('/api/admin/logout', { method: 'POST' });
        router.push('/admin');
    } catch {
        router.push('/admin');
    }
}

function formatDate (dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
</script>
