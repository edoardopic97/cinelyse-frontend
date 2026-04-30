import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { setUserProfile, updateUserProfile } from '../lib/firestore';
import t from '../i18n';

const AVATARS = ['🎬','🎥','🎞️','🍿','🎭','🎪','🎨','🎯','🎮','🎲','🎸','🎹','🚀','🌟','⭐','✨','🔥','💫','🦁','🐯','🐻','🐼','🐨','🦊'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditProfileModal({ visible, onClose, onSaved }: Props) {
  const { user, profile, refreshProfile, deleteAccount } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [avatar, setAvatar] = useState(profile?.photoURL || AVATARS[0]);
  const [showAvatars, setShowAvatars] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isGoogle = user?.providerData?.some(p => p.providerId === 'google.com');

  const handleDelete = async () => {
    if (!isGoogle && !deletePassword.trim()) {
      Alert.alert(t.error, 'Please enter your password');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(isGoogle ? undefined : deletePassword);
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
        ? t.incorrectPassword
        : t.failedDeleteAccount;
      Alert.alert(t.error, msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await setUserProfile(user.uid, { email: user.email || '', displayName: displayName || undefined, photoURL: avatar });
      await updateUserProfile(user.uid, { displayName: displayName || undefined, photoURL: avatar });
      await refreshProfile();
      onSaved();
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.title}>{t.editProfile}</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.muted} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.label}>{t.avatar}</Text>
          <View style={s.avatarRow}>
            <View style={s.avatarPreview}>
              {avatar?.startsWith('http')
                ? <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
                : <Text style={{ fontSize: 40 }}>{avatar}</Text>}
            </View>
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={s.changeBtn} onPress={() => { setShowAvatars(!showAvatars); setShowUrlInput(false); }}>
                <Text style={s.changeBtnText}>{showAvatars ? t.hideEmojis : t.chooseEmoji}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.changeBtn} onPress={() => { setShowUrlInput(!showUrlInput); setShowAvatars(false); }}>
                <Ionicons name="link-outline" size={14} color={colors.red} />
                <Text style={s.changeBtnText}>{showUrlInput ? t.hide : t.imageUrl}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showUrlInput && (
            <View style={s.urlSection}>
              <TextInput
                style={s.input}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder={t.pasteImageUrl}
                placeholderTextColor={colors.subtle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                style={[s.saveBtn, { marginTop: 8, opacity: imageUrl.startsWith('http') ? 1 : 0.4 }]}
                disabled={!imageUrl.startsWith('http')}
                onPress={() => { setAvatar(imageUrl.trim()); setShowUrlInput(false); setImageUrl(''); }}
              >
                <Text style={s.saveText}>{t.useThisImage}</Text>
              </TouchableOpacity>
            </View>
          )}
          {showAvatars && (
            <View style={s.avatarGrid}>
              {AVATARS.map(a => (
                <TouchableOpacity key={a} style={[s.avatarOption, avatar === a && s.avatarSelected]} onPress={() => { setAvatar(a); setShowAvatars(false); }}>
                  <Text style={{ fontSize: 28 }}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={s.label}>{t.displayName}</Text>
          <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder={t.enterDisplayName} placeholderTextColor={colors.subtle} />
          <Text style={s.label}>{t.emailReadOnly}</Text>
          <TextInput style={[s.input, { color: colors.subtle }]} value={user?.email || ''} editable={false} />
          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelText}>{t.cancel}</Text></TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>{t.saveChanges}</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.deleteBtn} onPress={() => {
            Alert.alert(
              t.deleteAccount,
              t.deleteAccountWarning,
              [
                { text: t.cancel, style: 'cancel' },
                { text: t.continue, style: 'destructive', onPress: () => {
                  if (isGoogle) {
                    handleDelete();
                  } else {
                    setShowDeleteConfirm(true);
                  }
                }},
              ],
            );
          }}>
            <Ionicons name="trash-outline" size={16} color="#ff3b30" />
            <Text style={s.deleteBtnText}>{t.deleteAccount}</Text>
          </TouchableOpacity>

          {showDeleteConfirm && !isGoogle && (
            <View style={s.deleteConfirm}>
              <Text style={s.deleteConfirmLabel}>{t.enterPasswordConfirm}</Text>
              <TextInput
                style={s.input}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Password"
                placeholderTextColor={colors.subtle}
                secureTextEntry
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <TouchableOpacity style={[s.cancelBtn, { flex: 1 }]} onPress={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}>
                  <Text style={s.cancelText}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.deleteBtn, { flex: 1, marginTop: 0 }]} onPress={handleDelete} disabled={deleting}>
                  {deleting ? <ActivityIndicator color="#ff3b30" size="small" /> : <Text style={s.deleteBtnText}>{t.deleteForever}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  title: { color: colors.white, fontSize: 20, fontWeight: '800' },
  body: { padding: 20, gap: 16, paddingBottom: 40 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarPreview: { width: 80, height: 80, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2, borderColor: 'rgba(229,9,20,0.3)', alignItems: 'center', justifyContent: 'center' },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(229,9,20,0.2)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.4)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  urlSection: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 },
  changeBtnText: { color: colors.red, fontSize: 14, fontWeight: '600' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarOption: { width: 56, height: 56, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  avatarSelected: { borderColor: colors.red, backgroundColor: 'rgba(229,9,20,0.2)' },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 14, fontSize: 15, color: colors.text },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 14, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: colors.red, borderRadius: 8, padding: 14, alignItems: 'center' },
  saveText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderRadius: 10, paddingVertical: 14, marginTop: 24 },
  deleteBtnText: { color: '#ff3b30', fontSize: 14, fontWeight: '700' },
  deleteConfirm: { backgroundColor: 'rgba(255,59,48,0.05)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)', borderRadius: 12, padding: 16, marginTop: 12, gap: 10 },
  deleteConfirmLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
