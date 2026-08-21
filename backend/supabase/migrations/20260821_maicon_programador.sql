update public.users
set roleid = 2
where lower(trim(username)) = lower('Maicon Douglas Mendonça Soares');

update public.usuario_perfis
set tipo_acesso = 'programador', ativo = true
where lower(trim(nome)) = lower('Maicon Douglas Mendonça Soares')
   or user_id in (
     select cast(userid as text)
     from public.users
     where lower(trim(username)) = lower('Maicon Douglas Mendonça Soares')
   );
