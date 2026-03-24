import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { setUserProfile } from '../lib/firestore';

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
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await setUserProfile(user.uid, { email: user.email || '', displayName: displayName || undefined, photoURL: avatar });
      await refreshProfile();
      onSaved();
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.title}>Edit Profile</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.muted} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.label}>AVATAR</Text>
          <View style={s.avatarRow}>
            <View style={s.avatarPreview}><Text style={{ fontSize: 40 }}>{avatar}</Text></View>
            <TouchableOpacity style={s.changeBtn} onPress={() => setShowAvatars(!showAvatars)}>
              <Text style={s.changeBtnText}>{showAvatars ? 'Hide' : 'Change Avatar'}</Text>
            </TouchableOpacity>
          </View>
          {showAvatars && (
            <View style={s.avatarGrid}>
              {AVATARS.map(a => (
                <TouchableOpacity key={a} style={[s.avatarOption, avatar === a && s.avatarSelected]} onPress={() => { setAvatar(a); setShowAvatars(false); }}>
                  <Text style={{ fontSize: 28 }}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={s.label}>DISPLAY NAME</Text>
          <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="Enter display name" placeholderTextColor={colors.subtle} />
          <Text style={s.label}>EMAIL (READ-ONLY)</Text>
          <TextInput style={[s.input, { color: colors.subtle }]} value={user?.email || ''} editable={false} />
          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.deleteBtn} onPress={() => Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all your data. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteAccount().catch(() =>
                Alert.alert('Error', 'Failed to delete account. You may need to sign in again before deleting.')
              )},
            ],
          )}>
            <Ionicons name="trash-outline" size={16} color="#ff3b30" />
            <Text style={s.deleteBtnText}>Delete Account</Text>
          </TouchableOpacity>
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
  changeBtn: { backgroundColor: 'rgba(229,9,20,0.2)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.4)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
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
});
